/**
 * Readiness score — deterministic, transparent, tuned for hoopers.
 * Input: last night's sleep + morning HRV/RHR + soreness + upcoming game load.
 * Output: 0-100 score + a session prescription.
 *
 * This is intentionally NOT an LLM call. Athletes trust numbers they can back-solve.
 * The LLM comes later for exercise selection & tone.
 */

export type ReadinessInput = {
  sleep_hours: number | null;
  sleep_quality: number | null;    // 1-10
  soreness: number | null;         // 1-10 (10 = worst)
  stress: number | null;           // 1-10
  hrv_ms: number | null;
  resting_hr: number | null;
  hrv_baseline_ms?: number | null;
  rhr_baseline?: number | null;
  hours_to_next_game: number | null;
  travel_km_today: number;
  tz_shift_hours: number;          // absolute
  aqi_us: number | null;
};

export type Prescription = {
  score: number;                                     // 0-100
  band: "green" | "yellow" | "orange" | "red";
  session_type: "power" | "strength" | "hypertrophy" | "conditioning" | "shootaround" | "recovery" | "rest";
  intensity: number;                                 // 1-10
  duration_min: number;
  focus: string[];
  drivers: Array<{ factor: string; delta: number; note: string }>;
};

export function scoreReadiness(i: ReadinessInput): Prescription {
  let score = 70;
  const drivers: Prescription["drivers"] = [];

  // Sleep duration (biggest single lever)
  if (i.sleep_hours != null) {
    const d = clamp((i.sleep_hours - 7) * 6, -18, 12);
    score += d;
    drivers.push({ factor: "sleep_hours", delta: d, note: `${i.sleep_hours}h vs 7h target` });
  }
  if (i.sleep_quality != null) {
    const d = (i.sleep_quality - 6) * 1.5;
    score += d;
    drivers.push({ factor: "sleep_quality", delta: d, note: `quality ${i.sleep_quality}/10` });
  }

  // Soreness (inverse)
  if (i.soreness != null) {
    const d = -(i.soreness - 3) * 2;
    score += d;
    drivers.push({ factor: "soreness", delta: d, note: `${i.soreness}/10` });
  }

  // Stress
  if (i.stress != null) {
    const d = -(i.stress - 4) * 1.2;
    score += d;
    drivers.push({ factor: "stress", delta: d, note: `${i.stress}/10` });
  }

  // HRV vs personal baseline
  if (i.hrv_ms != null && i.hrv_baseline_ms) {
    const pct = (i.hrv_ms - i.hrv_baseline_ms) / i.hrv_baseline_ms;
    const d = clamp(pct * 40, -12, 10);
    score += d;
    drivers.push({ factor: "hrv", delta: d, note: `${(pct * 100).toFixed(0)}% vs baseline` });
  }
  if (i.resting_hr != null && i.rhr_baseline) {
    const dRhr = i.resting_hr - i.rhr_baseline;
    const d = clamp(-dRhr * 0.8, -8, 6);
    score += d;
    drivers.push({ factor: "rhr", delta: d, note: `+${dRhr} bpm vs baseline` });
  }

  // Travel / timezone shift
  if (i.tz_shift_hours && Math.abs(i.tz_shift_hours) >= 2) {
    const d = -Math.min(10, Math.abs(i.tz_shift_hours) * 2);
    score += d;
    drivers.push({ factor: "tz_shift", delta: d, note: `${i.tz_shift_hours}h shift` });
  }
  if (i.travel_km_today > 800) {
    score -= 4;
    drivers.push({ factor: "travel", delta: -4, note: `${i.travel_km_today} km` });
  }

  // Air quality
  if (i.aqi_us != null && i.aqi_us > 100) {
    const d = -Math.min(10, (i.aqi_us - 100) / 15);
    score += d;
    drivers.push({ factor: "air_quality", delta: d, note: `AQI ${i.aqi_us}` });
  }

  // Game proximity — protect legs 24-36h out
  if (i.hours_to_next_game != null && i.hours_to_next_game <= 36) {
    const d = i.hours_to_next_game <= 12 ? -15 : -8;
    score += d;
    drivers.push({ factor: "game_proximity", delta: d, note: `${i.hours_to_next_game}h to tipoff` });
  }

  score = clamp(Math.round(score), 0, 100);

  return { ...prescribe(score, i), score, drivers };
}

function prescribe(score: number, i: ReadinessInput): Omit<Prescription, "score" | "drivers"> {
  const gameSoon = i.hours_to_next_game != null && i.hours_to_next_game <= 24;

  if (gameSoon) {
    return {
      band: score >= 70 ? "green" : score >= 55 ? "yellow" : "orange",
      session_type: "shootaround",
      intensity: 3,
      duration_min: 45,
      focus: ["shooting","light footwork","activation"],
    };
  }
  if (score >= 80) return { band: "green",  session_type: "power",        intensity: 8, duration_min: 70, focus: ["plyo","olympic lifts","single-leg power"] };
  if (score >= 65) return { band: "green",  session_type: "strength",     intensity: 7, duration_min: 65, focus: ["posterior chain","upper push/pull"] };
  if (score >= 50) return { band: "yellow", session_type: "hypertrophy",  intensity: 6, duration_min: 55, focus: ["accessories","core","stability"] };
  if (score >= 35) return { band: "orange", session_type: "conditioning", intensity: 4, duration_min: 40, focus: ["zone-2","mobility","tissue work"] };
  return             { band: "red",    session_type: "recovery",     intensity: 2, duration_min: 30, focus: ["mobility","breathwork","sauna/cold"] };
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
