-- Hoops Prep OS — schema
-- Run once against your Supabase Postgres.
-- Assumes Supabase auth.users exists.

create extension if not exists "pgcrypto";

-- ---------- Athletes ----------
create table if not exists athletes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  display_name text,
  position text check (position in ('PG','SG','SF','PF','C','G','F','U')) default 'U',
  height_cm numeric(5,2),
  weight_kg numeric(5,2),
  training_age_years numeric(4,1) default 0,
  hand_dominance text default 'R',
  timezone text default 'America/New_York',
  city text,
  country text,
  lat numeric(9,6),
  lon numeric(9,6),
  season_phase text check (season_phase in ('offseason','preseason','in-season','playoffs')) default 'offseason',
  goals jsonb default '{}'::jsonb,
  equipment jsonb default '["barbell","dumbbell","resistance band","body weight"]'::jsonb,
  injuries jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- Games / travel schedule ----------
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  tipoff_at timestamptz not null,
  opponent text,
  home boolean default true,
  travel_km numeric(8,2) default 0,
  importance smallint default 1 check (importance between 1 and 5),
  notes text,
  created_at timestamptz default now()
);
create index if not exists games_athlete_tipoff_idx on games (athlete_id, tipoff_at);

-- ---------- Recovery logs (daily) ----------
create table if not exists recovery_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  log_date date not null,
  sleep_hours numeric(4,2),
  sleep_quality smallint check (sleep_quality between 1 and 10),
  soreness smallint check (soreness between 1 and 10),
  stress smallint check (stress between 1 and 10),
  hrv_ms numeric(6,2),
  resting_hr smallint,
  vo2_max numeric(4,1),                              -- Apple Watch
  deep_sleep_min int,                                -- Apple Watch stages
  rem_sleep_min int,
  core_sleep_min int,
  source text default 'manual',                      -- 'manual'|'apple_watch'|'whoop'|'oura'
  mood smallint check (mood between 1 and 10),
  notes text,
  created_at timestamptz default now(),
  unique (athlete_id, log_date)
);

-- ---------- Generated daily plans ----------
create table if not exists daily_plans (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  plan_date date not null,
  readiness_score smallint,             -- 0-100
  session_type text,                    -- 'strength','power','conditioning','recovery','rest','shootaround'
  intensity smallint,                   -- 1-10
  duration_min smallint,
  focus text[],                         -- ['posterior chain','single-leg','plyo']
  blocks jsonb not null,                -- structured workout blocks (see agent output schema)
  rationale text,                       -- why this plan today
  nutrition jsonb,                      -- macros + suggestions
  environment jsonb,                    -- aqi, travel, tz shift
  created_at timestamptz default now(),
  unique (athlete_id, plan_date)
);

-- ---------- Passive workout ingestion (Apple Watch, WHOOP, etc.) ----------
create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  workout_date date not null,
  activity_name text not null,                       -- "Basketball", "Traditional Strength Training", ...
  session_type text,                                 -- mapped: conditioning|strength|sport|recovery
  duration_min int not null,
  active_calories int,
  avg_hr numeric(5,1),
  max_hr numeric(5,1),
  rpe smallint,                                      -- derived from HR when not provided
  start_at timestamptz,
  end_at timestamptz,
  source text default 'apple_watch',
  raw jsonb,
  created_at timestamptz default now(),
  unique (athlete_id, workout_date, duration_min, activity_name, start_at)
);
create index if not exists workouts_athlete_date_idx on workouts(athlete_id, workout_date desc);

-- ---------- Completed sessions ----------
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  plan_id uuid references daily_plans(id) on delete set null,
  performed_at timestamptz default now(),
  rpe smallint check (rpe between 1 and 10),
  duration_min smallint,
  volume jsonb,                         -- per-exercise sets/reps/load
  notes text
);

-- ---------- Meals (from AI Workout Planner analyzeFoodPlate) ----------
create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  eaten_at timestamptz default now(),
  photo_url text,
  kcal integer,
  protein_g numeric(6,2),
  carb_g numeric(6,2),
  fat_g numeric(6,2),
  items jsonb,
  raw jsonb                             -- full API response for audit
);

-- ---------- Muscle exposure roll-ups (for weekly heatmap) ----------
create table if not exists muscle_exposure (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  week_start date not null,             -- Monday
  muscle text not null,
  sets integer default 0,
  unique (athlete_id, week_start, muscle)
);

-- ---------- RLS ----------
alter table athletes enable row level security;
alter table games enable row level security;
alter table recovery_logs enable row level security;
alter table daily_plans enable row level security;
alter table sessions enable row level security;
alter table workouts enable row level security;
alter table meals enable row level security;
alter table muscle_exposure enable row level security;

-- Helper: get athlete_id from auth.uid()
create or replace function current_athlete_id() returns uuid
language sql stable as $$
  select id from athletes where user_id = auth.uid() limit 1;
$$;

-- Policies (athlete owns their rows)
create policy "athletes self read"  on athletes for select using (user_id = auth.uid());
create policy "athletes self write" on athletes for insert with check (user_id = auth.uid());
create policy "athletes self update" on athletes for update using (user_id = auth.uid());

do $$
declare t text;
begin
  for t in select unnest(array['games','recovery_logs','daily_plans','sessions','workouts','meals','muscle_exposure']) loop
    execute format($f$
      create policy "%1$s_owner_all" on %1$I
        for all
        using (athlete_id = current_athlete_id())
        with check (athlete_id = current_athlete_id());
    $f$, t);
  end loop;
exception when duplicate_object then null;
end $$;
