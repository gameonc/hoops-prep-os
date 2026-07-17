# Hoops Prep OS

AI training + recovery agent for basketball players. Reads your sleep, HRV, soreness, upcoming games, travel, and outdoor air quality — then tells you exactly what to lift today.

Built on Next.js 15 + Supabase + a curated stack of RapidAPI health/fitness services.

---

## Why this exists

Every fitness app treats you like a generic gym-goer. Hoopers have a different problem: **your training has to protect Wednesday's game.** Hoops Prep OS is a small agent that reads your context (readiness + game schedule + environment) and prescribes a specific lift/recovery session — with a transparent 0–100 readiness score you can back-solve.

The moat isn't the exercise database. It's the **orchestration**:
- **Deterministic readiness score** (no black-box LLM) drives session type & intensity
- **Position-aware focus** (PG = single-leg power; C = hip mobility; PF = landing mechanics)
- **Game-proximity guardrails** (24–36h before tipoff we protect your legs automatically)
- **Environment-aware** (AQI too high → conditioning goes indoors)

---

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 15 App Router + TypeScript + Tailwind |
| Auth + DB | Supabase (Postgres + RLS + Auth) |
| Hosting | Vercel |
| Exercise data | RapidAPI · ExerciseDB (1,300+ exercises + animated GIFs) |
| AI plan fallback | RapidAPI · AI Workout Planner (`generateWorkoutPlan`, `analyzeFoodPlate`) |
| Air quality | IQAir direct (recommended) *or* RapidAPI AirVisual listings |
| Muscle heatmap | RapidAPI · Muscle Group Image Generator V3 |
| Load estimate | RapidAPI · Calories Burned by API-Ninjas |

---

## Setup

### 1. Clone + install
```bash
npm install
cp .env.example .env.local
```

### 2. Supabase
1. Create a new Supabase project → grab the URL, anon key, and service-role key into `.env.local`.
2. Open the SQL editor and paste `supabase/schema.sql`, then run.
3. Enable Email auth in Authentication → Providers (magic-link is fine for MVP).

### 3. RapidAPI
Create a free RapidAPI account and subscribe to the free tier of each API you plan to use:
- [ExerciseDB](https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb/pricing) — freemium, ~$0-30/mo
- [AI Workout Planner](https://rapidapi.com/ltdbilgisam/api/ai-workout-planner-exercise-fitness-nutrition-guide/pricing) — BASIC free (25 req/mo), PRO $9.99 (500/mo) — note: use the `ltdbilgisam` listing, the older `rakib9587` one is dead
- [Muscle Group Image Generator](https://rapidapi.com/mertronlp/api/muscle-group-image-generator/pricing) — freemium
- [Calories Burned by API-Ninjas](https://rapidapi.com/apininjas/api/calories-burned-by-api-ninjas/pricing) — free 10k req/mo

Copy your single RapidAPI key into `RAPIDAPI_KEY`. That one key works for every RapidAPI-hosted API.

### 3b. Apple Watch → Hoops Prep (optional but recommended)

Hoops Prep OS ingests Apple Watch data via [Health Auto Export](https://www.healthexportapp.com/) (iOS app). No native iOS build needed — the phone POSTs JSON to your Vercel URL.

1. Install Health Auto Export on your iPhone and grant Apple Health read permissions for: Workouts, Sleep Analysis, Heart Rate, Resting Heart Rate, VO2 Max.
2. Set `WEARABLES_WEBHOOK_TOKEN` to a long random string in `.env` and Vercel.
3. In Health Auto Export → Automations, create a REST API destination:
   - URL: `https://<your-hoops-domain>/api/wearables/webhook?athlete=<YOUR_ATHLETE_UUID>`
   - Method: POST
   - Header: `X-OPENCLAW-TOKEN: <your token>`
   - Format: **JSON** (aggregated, hourly recommended)
   - Metrics to include: Sleep Analysis, Heart Rate, Resting Heart Rate, VO2 Max, Workouts
4. Get your athlete UUID from Supabase after signup, or use the /onboarding flow to create your profile.

The webhook parser is a 1:1 port of the battle-tested `gameonc/trading-tools` health receiver — same v2 payload shape, same workout-type map, same hours-vs-minutes sleep unit detection, same HR→RPE table.

### 3c. Preview the dashboard with sample data

Want to see the dashboard populated before wiring the phone? After signing up and completing onboarding, hit the dev seeder in the browser console or curl:

```bash
curl -X POST http://localhost:3000/api/dev/seed --cookie "sb-access-token=..."
```

Or in the browser after signing in: paste `await fetch('/api/dev/seed',{method:'POST'}).then(r=>r.json())` in DevTools. It writes 14 days of realistic recovery + workouts + one upcoming sample game so every sparkline renders. Deterministic per athlete — re-seeding is idempotent. Blocked in production unless `ALLOW_SEED=1` is set.


### 4. Air quality
By default the app hits IQAir directly (their free tier is 10K req/month vs. RapidAPI's rate limits):
1. Get a free key at [iqair.com/air-pollution-data-api](https://www.iqair.com/air-pollution-data-api)
2. Set `IQAIR_KEY=...` and leave `RAPIDAPI_AIRQUALITY_FLAVOR=iqair-direct`.

If you'd rather use a RapidAPI listing instead, set `RAPIDAPI_AIRQUALITY_FLAVOR=airvisual1` and confirm the exact host slug from your subscribed listing's Endpoints tab.

### 5. Run
```bash
npm run dev
# open http://localhost:3000
```

---

## User flow

1. **`/onboarding`** — set position, height/weight, city (lat/lon), season phase, equipment.
2. **`/log`** — morning check-in: sleep hours, sleep quality, soreness, stress, HRV, resting HR.
3. **`/schedule`** — add upcoming games (tipoff, opponent, travel km, importance).
4. **`/dashboard`** — click "Build today's plan". The agent:
   - Computes a **readiness score (0–100)** from your check-in + baselines + game proximity + AQI
   - Picks a **session type** (power / strength / hypertrophy / conditioning / shootaround / recovery / rest)
   - Filters ExerciseDB by target muscle × your equipment × basketball relevance
   - Assembles warmup → main block → accessories → cooldown
   - Writes a plain-English rationale ("Readiness 62/100 — game in 30h — protecting your legs")
   - Persists the plan (upsert on athlete + date)

---

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Landing
│   ├── onboarding/           # Athlete profile
│   ├── log/                  # Daily recovery check-in
│   ├── schedule/             # Games CRUD
│   ├── dashboard/            # Today's plan (client)
│   └── api/
│       ├── plan/             # POST → build & persist plan; GET → fetch
│       ├── recovery/         # POST → upsert daily check-in
│       ├── schedule/         # POST/GET → games
│       ├── food/             # POST { image_url } → analyzeFoodPlate → meals
│       ├── muscle-image/     # Proxy for muscle-group image gen (keeps key server-side)
│       └── exercise-image/   # Proxy for ExerciseDB /image endpoint
├── lib/
│   ├── agent/
│   │   ├── readiness.ts      # 0-100 scorer + prescription (deterministic)
│   │   └── planner.ts        # Orchestrator (readiness + APIs → structured plan)
│   ├── rapidapi/
│   │   ├── base.ts           # Shared fetcher + in-memory cache
│   │   ├── exercisedb.ts
│   │   ├── aiWorkout.ts
│   │   ├── airQuality.ts
│   │   ├── muscleImage.ts
│   │   └── calories.ts
│   └── supabase/{server,client}.ts
└── components/{ReadinessDial, PlanBlocks, MuscleHeatmap}.tsx
```

### The readiness scorer

Deterministic, transparent, and personalized (uses your HRV/RHR baselines when available). See `src/lib/agent/readiness.ts`. Each factor contributes a signed delta:

| Factor | Contribution |
|---|---|
| Sleep hours vs 7h | ±18 (biggest lever) |
| Sleep quality (1–10) | ±6 |
| Soreness (1–10, inverse) | ±14 |
| Stress (1–10, inverse) | ±7 |
| HRV vs baseline (%) | ±12 |
| Resting HR vs baseline | ±8 |
| Timezone shift ≥2h | −(shift × 2) |
| Travel >800 km | −4 |
| AQI >100 | up to −10 |
| Game <36h out | −8 to −15 |

Then the score maps to a session type + intensity. Athletes trust this because they can back-solve every number.

---

## Deploy to Vercel

### One-click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_USER%2Fhoops-prep-os&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,RAPIDAPI_KEY,RAPIDAPI_AIRQUALITY_FLAVOR,IQAIR_KEY&envDescription=See%20README%20for%20setup&envLink=https%3A%2F%2Fgithub.com%2FYOUR_USER%2Fhoops-prep-os%23setup&project-name=hoops-prep-os&repository-name=hoops-prep-os)

Replace `YOUR_USER` in the button URL after you push to GitHub.

### Manual

```bash
npm i -g vercel
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add RAPIDAPI_KEY
vercel env add IQAIR_KEY
vercel --prod
```

### Required env on Vercel

| Variable | Required | Scope | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | All | From Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | All | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Production, Preview | Server-only, never expose |
| `RAPIDAPI_KEY` | ✅ | Production, Preview | One key for all RapidAPI services |
| `IQAIR_KEY` | Recommended | Production, Preview | Only if using `iqair-direct` flavor |
| `RAPIDAPI_AIRQUALITY_FLAVOR` | Optional | All | `iqair-direct` (default) / `airvisual1` / `raygorodskij` |
| `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | Optional | Production, Preview | Only when you enable LLM rationale polish |

### Health check

After deploy, hit `https://YOUR-APP.vercel.app/api/health` — you'll get JSON showing which env vars are wired. Point UptimeRobot / Better Stack at this URL.

### GitHub Actions

- **CI** (`.github/workflows/ci.yml`): runs typecheck + build on every push and PR. No secrets needed.
- **Vercel Preview** (`.github/workflows/preview.yml`): deploys a preview URL and comments it on your PR. Requires repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. If you use Vercel's native GitHub integration instead, delete this file.

---

## Roadmap

- [ ] Wearable ingestion: WeFitter (RapidAPI) or Apple HealthKit → auto-populate sleep/HRV
- [ ] Weekly muscle-exposure heatmap on the dashboard (component built, needs data pipeline)
- [ ] Post-session RPE + volume logging → adjusts next-day plan
- [ ] Anthropic/OpenAI LLM polish on the rationale (currently deterministic string composition)
- [ ] Multi-week periodization tied to season phase
- [ ] Team mode (coach dashboard reads readiness across a roster)
- [ ] React Native port

---

## Cost model

Free tier only, roughly $0/mo for a single athlete MVP:
- Supabase free (500 MB DB, 2 GB egress)
- Vercel Hobby (free)
- RapidAPI free tiers for each API
- IQAir free tier (10K req/mo)

Paid, per active user, at ExerciseDB Pro + AI Workout Planner Pro: ~$25/mo of infra, target price $30–50/mo/athlete.

---

## Notes for the builder

- **ExerciseDB current-schema entries may not include `gifUrl`.** Use `displayImageForExercise()` — it falls back to the `/image` endpoint proxied through `/api/exercise-image`.
- **AI Workout Planner: 4 of 5 endpoints have unverified body schemas.** `generateWorkoutPlan` is fully confirmed. For `analyzeFoodPlate`, `nutritionAdvice`, `customWorkoutPlan`, and `exerciseDetails`, open the RapidAPI playground under your subscription and confirm request field names.
- **AirVisual has multiple listings on RapidAPI.** The default flavor is `iqair-direct` (bypasses RapidAPI) — cleanest and most reliable. If you prefer RapidAPI, verify the host slug from your subscribed listing.
- **Muscle Group Image Generator** upgraded to V3 (`/v2/images/single`). The proxy in `/api/muscle-image` falls back to legacy `/getImage` on 404.
