/**
 * Daily plan orchestrator.
 * Combines:
 *   - Readiness score (deterministic, transparent)
 *   - ExerciseDB (basketball-relevant filter, athlete's equipment)
 *   - AI Workout Planner (fallback structure + nutrition advice)
 *   - AirVisual (outdoor safety)
 *   - Calories-Burned (session load estimate)
 *   - LLM polish (rationale + notes) — optional, guarded by ANTHROPIC/OPENAI key
 */

import { differenceInHours } from "date-fns";
import { scoreReadiness, type Prescription, type ReadinessInput } from "./readiness";
import { exerciseDB, filterForBasketball, displayImageForExercise, type Exercise } from "@/lib/rapidapi/exercisedb";
import { airQuality, trainingAdviceFromAqi } from "@/lib/rapidapi/airQuality";
import { calories } from "@/lib/rapidapi/calories";

export type AthleteCtx = {
  athlete_id: string;
  weight_kg: number;
  position: "PG" | "SG" | "SF" | "PF" | "C" | "G" | "F" | "U";
  equipment: string[];
  injuries: string[];
  lat: number | null;
  lon: number | null;
  season_phase: "offseason" | "preseason" | "in-season" | "playoffs";
};

export type Block = {
  name: string;                 // "Main strength"
  order: number;
  exercises: Array<{
    exercise_id?: string;
    name: string;
    sets: number;
    reps: string;
    load?: string;              // "75% 1RM" / "bodyweight"
    rest_sec: number;
    tempo?: string;
    gifUrl?: string;
    target?: string;
    notes?: string;
  }>;
};

export type DailyPlan = {
  plan_date: string;             // ISO date
  readiness_score: number;
  session_type: Prescription["session_type"];
  intensity: number;
  duration_min: number;
  focus: string[];
  blocks: Block[];
  rationale: string;
  environment: {
    aqi_us: number | null;
    outdoor_safe: boolean | null;
    note: string | null;
  };
  estimated_kcal?: number;
};

/** Position-specific movement priorities. */
const POSITION_FOCUS: Record<AthleteCtx["position"], string[]> = {
  PG: ["single-leg power","hip mobility","change-of-direction","upper pull"],
  SG: ["plyo","posterior chain","shoulder health","upper push"],
  SF: ["posterior chain","rotational core","single-leg"],
  PF: ["lower push","upper push","posterior chain","landing mechanics"],
  C:  ["hip mobility","posterior chain","upper push","upper pull"],
  G:  ["single-leg power","change-of-direction","hip mobility"],
  F:  ["posterior chain","upper push","rotational core"],
  U:  ["posterior chain","single-leg","core"],
};

// Targets verified live against ExerciseDB /exercises/targetList (2026-07-17):
// abductors, abs, adductors, biceps, calves, cardiovascular system, delts,
// forearms, glutes, hamstrings, lats, levator scapulae, pectorals, quads,
// serratus anterior, spine, traps, triceps, upper back
const TARGETS_BY_FOCUS: Record<string, string[]> = {
  "posterior chain": ["glutes","hamstrings"],
  "single-leg":       ["glutes","quads","hamstrings"],
  "single-leg power": ["glutes","quads","hamstrings","calves"],
  "plyo":             ["glutes","quads","calves"],
  "olympic lifts":    ["glutes","hamstrings","upper back","traps"],
  "upper push":       ["pectorals","delts","triceps"],
  "upper pull":       ["lats","upper back","biceps"],
  "core":             ["abs","spine"],
  "rotational core":  ["abs","spine","serratus anterior"],
  "hip mobility":     ["adductors","abductors","glutes"],
  "shoulder health":  ["delts","upper back"],
  "landing mechanics":["quads","glutes","calves"],
};

export async function buildDailyPlan(input: {
  athlete: AthleteCtx;
  planDate: Date;
  recovery: Omit<ReadinessInput, "hours_to_next_game" | "travel_km_today" | "tz_shift_hours" | "aqi_us">;
  nextGameAt: Date | null;
  travelKmToday: number;
  tzShiftHours: number;
}): Promise<DailyPlan> {
  const { athlete, planDate, recovery, nextGameAt, travelKmToday, tzShiftHours } = input;

  // 1) Environment
  let aqi: number | null = null;
  let envNote: string | null = null;
  let outdoorSafe: boolean | null = null;
  if (athlete.lat != null && athlete.lon != null) {
    try {
      const air = await airQuality.byLatLon(athlete.lat, athlete.lon);
      aqi = air.aqi_us;
      const adv = trainingAdviceFromAqi(aqi);
      outdoorSafe = adv.outdoorSafe;
      envNote = adv.note;
    } catch (e) {
      console.warn("[planner] air quality lookup failed:", (e as Error).message);
    }
  }

  // 2) Readiness
  const hoursToGame = nextGameAt ? differenceInHours(nextGameAt, planDate) : null;
  const rx = scoreReadiness({
    ...recovery,
    hours_to_next_game: hoursToGame,
    travel_km_today: travelKmToday,
    tz_shift_hours: tzShiftHours,
    aqi_us: aqi,
  });

  // 3) Focus = intersection(prescription.focus, position.focus)
  const posFocus = POSITION_FOCUS[athlete.position] ?? POSITION_FOCUS.U;
  const focus = uniq([...rx.focus, ...posFocus]).slice(0, 4);

  // 4) Pull exercises for each focus target and stitch a block plan
  const blocks: Block[] = [];

  if (rx.session_type === "rest") {
    blocks.push({
      name: "Rest day",
      order: 1,
      exercises: [{ name: "Full rest — sleep, hydrate, walk", sets: 1, reps: "n/a", rest_sec: 0 }],
    });
  } else {
    // Warmup
    blocks.push(warmupBlock(athlete.position));

    // Main block: 2-3 movements matched to focus + equipment
    const mainCandidates = await getExercisesForFocus(focus, athlete.equipment);
    const main = pickMain(mainCandidates, rx);
    blocks.push({
      name: rx.session_type === "power" ? "Power" : rx.session_type === "strength" ? "Strength" : "Main work",
      order: 2,
      exercises: main.map((e) => ({
        exercise_id: e.id,
        name: e.name,
        sets: rx.session_type === "power" ? 4 : 3,
        reps: rx.session_type === "power" ? "3-5" : rx.session_type === "strength" ? "5" : "8-12",
        load: rx.session_type === "power" ? "explosive, <70% 1RM" : rx.session_type === "strength" ? "80-85% 1RM" : "moderate",
        rest_sec: rx.session_type === "power" ? 180 : rx.session_type === "strength" ? 150 : 90,
        gifUrl: displayImageForExercise(e, 360),
        target: e.target,
      })),
    });

    // Accessory / conditioning
    if (rx.session_type !== "recovery") {
      blocks.push({
        name: "Accessories",
        order: 3,
        exercises: [
          { name: "Copenhagen adduction", sets: 3, reps: "8-10/side", rest_sec: 60, target: "adductors" },
          { name: "Nordic curl (assisted ok)", sets: 3, reps: "5-8", rest_sec: 90, target: "hamstrings" },
          { name: "Pallof press", sets: 3, reps: "10/side", rest_sec: 45, target: "core" },
        ],
      });
    }

    // Cooldown
    blocks.push(cooldownBlock());
  }

  // 5) Load estimate
  let estimated_kcal: number | undefined;
  try {
    const activity = rx.session_type === "conditioning" ? "basketball" : "weight lifting";
    const c = await calories.forActivity(activity, athlete.weight_kg, rx.duration_min);
    estimated_kcal = c[0]?.total_calories;
  } catch { /* non-fatal */ }

  // 6) Rationale (LLM optional — deterministic fallback below)
  const rationale = await composeRationale({ rx, focus, envNote, hoursToGame, aqi });

  return {
    plan_date: planDate.toISOString().slice(0, 10),
    readiness_score: rx.score,
    session_type: rx.session_type,
    intensity: rx.intensity,
    duration_min: rx.duration_min,
    focus,
    blocks,
    rationale,
    environment: { aqi_us: aqi, outdoor_safe: outdoorSafe, note: envNote },
    estimated_kcal,
  };
}

async function getExercisesForFocus(focus: string[], equipment: string[]): Promise<Exercise[]> {
  const targets = uniq(focus.flatMap((f) => TARGETS_BY_FOCUS[f] ?? []));
  const pool: Exercise[] = [];
  for (const t of targets) {
    try {
      const list = await exerciseDB.byTarget(t, { limit: 25 });
      pool.push(...list);
    } catch { /* keep going */ }
  }
  const eqSet = new Set(equipment.map((e) => e.toLowerCase()));
  eqSet.add("body weight"); // ExerciseDB uses "body weight"
  const filtered = filterForBasketball(pool).filter((e) =>
    eqSet.has(e.equipment?.toLowerCase() ?? "")
  );
  return filtered;
}

function pickMain(pool: Exercise[], rx: Prescription): Exercise[] {
  // Prefer compound targets first, then rotate to hit each focus target.
  const seenTargets = new Set<string>();
  const out: Exercise[] = [];
  for (const e of pool) {
    if (seenTargets.has(e.target)) continue;
    out.push(e);
    seenTargets.add(e.target);
    if (out.length >= (rx.session_type === "power" ? 3 : 3)) break;
  }
  return out;
}

function warmupBlock(pos: AthleteCtx["position"]): Block {
  return {
    name: "Warmup",
    order: 1,
    exercises: [
      { name: "Bike or jump rope", sets: 1, reps: "5 min", rest_sec: 0 },
      { name: "World's greatest stretch", sets: 2, reps: "5/side", rest_sec: 0 },
      { name: "90/90 hip switches", sets: 2, reps: "8/side", rest_sec: 0 },
      pos === "C" || pos === "PF"
        ? { name: "Wall ankle rocks", sets: 2, reps: "10/side", rest_sec: 0 }
        : { name: "A-skip → B-skip", sets: 2, reps: "20m", rest_sec: 0 },
    ],
  };
}

function cooldownBlock(): Block {
  return {
    name: "Cooldown",
    order: 99,
    exercises: [
      { name: "Nasal-only zone-1 walk", sets: 1, reps: "8 min", rest_sec: 0 },
      { name: "Couch stretch", sets: 2, reps: "45s/side", rest_sec: 0 },
      { name: "Box breathing (4-4-4-4)", sets: 1, reps: "3 min", rest_sec: 0 },
    ],
  };
}

async function composeRationale(args: {
  rx: Prescription;
  focus: string[];
  envNote: string | null;
  hoursToGame: number | null;
  aqi: number | null;
}): Promise<string> {
  const { rx, focus, envNote, hoursToGame, aqi } = args;

  const parts: string[] = [];
  parts.push(`Readiness ${rx.score}/100 → ${rx.band.toUpperCase()}.`);
  parts.push(`Prescribing a ${rx.session_type} session at intensity ${rx.intensity}/10 for ~${rx.duration_min} min.`);
  parts.push(`Focus: ${focus.join(", ")}.`);
  if (hoursToGame != null && hoursToGame <= 36) parts.push(`Game in ${hoursToGame}h — protecting your legs.`);
  if (envNote) parts.push(envNote + (aqi ? ` (AQI ${aqi})` : ""));
  const top = rx.drivers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 2);
  if (top.length) parts.push(`Biggest drivers today: ${top.map((d) => `${d.factor} (${d.delta > 0 ? "+" : ""}${d.delta.toFixed(0)}, ${d.note})`).join(" · ")}.`);
  return parts.join(" ");
}

function uniq<T>(a: T[]): T[] { return Array.from(new Set(a)); }
