/**
 * Health Auto Export v2 payload parser.
 *
 * PORTED FROM: gameonc/trading-tools/scripts/health_receiver.py
 * Round-trip smoke tested against real Apple Watch v2 payload 2026-07-17.
 * Every branch below has a matching branch in the Python original.
 *
 * v2 payload shape (from Health Auto Export iOS app):
 *   { data: {
 *       workouts: [ { name, start, end, duration:{qty,units},
 *                    activeEnergyBurned:{qty,units},
 *                    heartRate:{avg:{qty},max:{qty}} | avgHeartRate | maxHeartRate,
 *                    ... } ],
 *       metrics:  [ { name:"Sleep Analysis"|"Heart Rate"|"Resting Heart Rate"|"VO2 Max",
 *                    units, data:[...] } ]
 *   } }
 */

// ── Types ────────────────────────────────────────────────────────────────

export type Qty = { qty?: number; units?: string } | number | string | undefined | null;

export type HAEWorkout = {
  name?: string;
  workoutActivityType?: string;
  start?: string;
  end?: string;
  startDate?: string;
  duration?: Qty;
  activeEnergyBurned?: Qty;
  activeEnergy?: Qty;
  heartRate?: { avg?: Qty; max?: Qty; min?: Qty };
  avgHeartRate?: Qty;
  maxHeartRate?: Qty;
  [k: string]: unknown;
};

export type HAESleepEntry = {
  date?: string;
  totalSleep?: number;
  asleep?: number;
  core?: number;
  deep?: number;
  rem?: number;
  sleepStart?: string;
  sleepEnd?: string;
  inBed?: number;
  inBedStart?: string;
  inBedEnd?: string;
};

export type HAEMetric = { name?: string; units?: string; data?: any[] };

export type HAEPayload = { data?: { workouts?: HAEWorkout[]; metrics?: HAEMetric[] } };

export type ParsedWorkout = {
  workout_date: string;
  activity_name: string;
  session_type: SessionType;
  duration_min: number;
  active_calories: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  rpe: number;
  start_at: string | null;
  end_at: string | null;
  raw: HAEWorkout;
};

export type ParsedSleep = {
  log_date: string;
  sleep_hours: number;                  // total
  sleep_quality: number;                // 1-5
  deep_sleep_min: number;
  rem_sleep_min: number;
  core_sleep_min: number;
  sleep_start: string | null;
  sleep_end: string | null;
};

export type ParsedRestingHR = {
  log_date: string;
  resting_hr: number;
};

export type ParsedVO2Max = {
  log_date: string;
  vo2_max: number;
};

export type ParseResult = {
  workouts: ParsedWorkout[];
  sleep: ParsedSleep[];
  resting_hr: ParsedRestingHR[];
  vo2_max: ParsedVO2Max[];
  errors: string[];
};

// ── Constants ports ──────────────────────────────────────────────────────

export type SessionType = "conditioning" | "strength" | "sport" | "recovery";

// EXACT port of WORKOUT_TYPE_MAP from health_receiver.py:31
const WORKOUT_TYPE_MAP: Record<string, SessionType> = {
  // conditioning
  "running": "conditioning",
  "walking": "conditioning",
  "cycling": "conditioning",
  "swimming": "conditioning",
  "hiit": "conditioning",
  "high intensity interval training": "conditioning",
  "elliptical": "conditioning",
  "stair climbing": "conditioning",
  "rowing": "conditioning",
  "jump rope": "conditioning",
  "dance": "conditioning",
  "hiking": "conditioning",
  // strength
  "traditional strength training": "strength",
  "functional strength training": "strength",
  "strength training": "strength",
  "functional training": "strength",
  "core training": "strength",
  // sport
  "basketball": "sport",
  "tennis": "sport",
  "soccer": "sport",
  "volleyball": "sport",
  "baseball": "sport",
  "football": "sport",
  "martial arts": "sport",
  "boxing": "sport",
  "kickboxing": "sport",
  "rugby": "sport",
  "hockey": "sport",
  "lacrosse": "sport",
  "badminton": "sport",
  "table tennis": "sport",
  "handball": "sport",
  "pickleball": "sport",
  "racquetball": "sport",
  "squash": "sport",
  "cricket": "sport",
  // recovery
  "yoga": "recovery",
  "stretching": "recovery",
  "cooldown": "recovery",
  "flexibility": "recovery",
  "tai chi": "recovery",
  "pilates": "recovery",
  "mindfulness": "recovery",
  "meditation": "recovery",
};

// ── Utility ports ────────────────────────────────────────────────────────

/** Port of _qty(): extract numeric value from v2 qty object or plain number. */
function qty(v: Qty): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  if (typeof v === "object") { const n = Number((v as any).qty ?? 0); return Number.isFinite(n) ? n : 0; }
  return 0;
}

/** Port of hr_to_rpe(). Estimate RPE from average heart rate. */
export function hrToRpe(avgHr: number): number {
  if (avgHr < 100) return 2;
  if (avgHr < 120) return 4;
  if (avgHr < 140) return 5;
  if (avgHr < 155) return 7;
  if (avgHr < 170) return 8;
  return 9;
}

/** Port of map_workout_type(). Falls back to conditioning like the original. */
export function mapWorkoutType(name: string): SessionType {
  return WORKOUT_TYPE_MAP[name.toLowerCase().trim()] ?? "conditioning";
}

/** Port of sleep_quality_score(). */
export function sleepQuality(totalHours: number): number {
  if (totalHours < 5) return 1;
  if (totalHours < 6) return 2;
  if (totalHours < 7) return 3;
  if (totalHours < 8) return 4;
  return 5;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Main parsers ─────────────────────────────────────────────────────────

/** Port of _process_workout(). */
export function parseWorkout(w: HAEWorkout): ParsedWorkout {
  let name = String(w.name ?? w.workoutActivityType ?? "Other");
  if (name.startsWith("HKWorkoutActivityType")) {
    name = name.replace("HKWorkoutActivityType", "");
  }
  const durationSec = qty(w.duration);
  const durationMin = Math.max(1, Math.floor(durationSec / 60));
  const activeCal = qty(w.activeEnergyBurned ?? w.activeEnergy);

  // heartRate can be nested {avg,max} or flat avgHeartRate/maxHeartRate
  let avgHr = 0, maxHr = 0;
  const hrObj = w.heartRate;
  if (hrObj && typeof hrObj === "object" && ("avg" in hrObj || "max" in hrObj)) {
    avgHr = qty(hrObj.avg);
    maxHr = qty(hrObj.max);
  } else {
    avgHr = qty(w.avgHeartRate);
    maxHr = qty(w.maxHeartRate);
  }

  const sessionType = mapWorkoutType(name);
  const rpe = avgHr > 0 ? hrToRpe(avgHr) : 5;

  // Date from workout start, "YYYY-MM-DD HH:mm:ss ±HHMM" or ISO
  const startStr = String(w.start ?? w.startDate ?? "");
  const dateStr = startStr.length >= 10 ? startStr.slice(0, 10) : today();

  return {
    workout_date: dateStr,
    activity_name: name,
    session_type: sessionType,
    duration_min: durationMin,
    active_calories: activeCal > 0 ? Math.round(activeCal) : null,
    avg_hr: avgHr > 0 ? avgHr : null,
    max_hr: maxHr > 0 ? maxHr : null,
    rpe,
    start_at: parseHAEDate(w.start) ?? null,
    end_at: parseHAEDate(w.end) ?? null,
    raw: w,
  };
}

/** Port of _process_sleep(). Handles the hours-vs-minutes unit detection. */
export function parseSleep(s: HAESleepEntry): ParsedSleep {
  const totalRaw = Number(s.totalSleep ?? s.asleep ?? 0) || 0;
  const deepRaw = Number(s.deep ?? 0) || 0;
  const remRaw = Number(s.rem ?? 0) || 0;
  const coreRaw = Number(s.core ?? 0) || 0;

  // v2 quirk: if totalSleep < 24, values are in hours; otherwise minutes.
  let totalHours: number, deepMin: number, remMin: number, coreMin: number;
  if (totalRaw < 24) {
    totalHours = round(totalRaw, 2);
    deepMin = round(deepRaw * 60, 1);
    remMin = round(remRaw * 60, 1);
    coreMin = round(coreRaw * 60, 1);
  } else {
    totalHours = round(totalRaw / 60, 2);
    deepMin = round(deepRaw, 1);
    remMin = round(remRaw, 1);
    coreMin = round(coreRaw, 1);
  }

  let dateStr = String(s.date ?? "");
  if (!dateStr && s.sleepEnd) dateStr = String(s.sleepEnd).slice(0, 10);
  if (!dateStr) dateStr = today();

  return {
    log_date: dateStr,
    sleep_hours: totalHours,
    sleep_quality: sleepQuality(totalHours),
    deep_sleep_min: Math.round(deepMin),
    rem_sleep_min: Math.round(remMin),
    core_sleep_min: Math.round(coreMin),
    sleep_start: parseHAEDate(s.sleepStart ?? s.inBedStart) ?? null,
    sleep_end: parseHAEDate(s.sleepEnd ?? s.inBedEnd) ?? null,
  };
}

/** Port of _process_heart_rate(). Returns *at most one* daily resting HR. */
export function parseHeartRate(hrData: any[], resting: boolean): ParsedRestingHR | null {
  const arr = Array.isArray(hrData) ? hrData : [hrData];
  const values: number[] = [];
  let latestDate = "";
  for (const r of arr) {
    if (!r || typeof r !== "object") continue;
    const v = Number(r.Min ?? r.Avg ?? r.qty ?? r.value ?? r.bpm ?? 0) || 0;
    if (v > 0) values.push(v);
    const d = String(r.date ?? "");
    if (d && d > latestDate) latestDate = d;
  }
  if (values.length === 0) return null;
  const bpm = resting ? values[values.length - 1] : Math.min(...values);
  return { log_date: latestDate.slice(0, 10) || today(), resting_hr: Math.round(bpm) };
}

/** Port of _process_vo2max(). */
export function parseVO2Max(vo2Data: any[]): ParsedVO2Max[] {
  const arr = Array.isArray(vo2Data) ? vo2Data : [vo2Data];
  const out: ParsedVO2Max[] = [];
  const seen = new Set<string>();
  for (const r of arr) {
    if (!r || typeof r !== "object") continue;
    const val = Number(r.qty ?? 0) || 0;
    if (val <= 0) continue;
    const d = (String(r.date ?? "").slice(0, 10)) || today();
    if (seen.has(d)) continue;
    seen.add(d);
    out.push({ log_date: d, vo2_max: round(val, 1) });
  }
  return out;
}

/** Main entry point — port of HealthReceiver.process_payload(). */
export function parseHAE(payload: HAEPayload): ParseResult {
  const errors: string[] = [];
  const workouts: ParsedWorkout[] = [];
  const sleep: ParsedSleep[] = [];
  const restingHr: ParsedRestingHR[] = [];
  const vo2Max: ParsedVO2Max[] = [];

  const data = payload?.data ?? (payload as any) ?? {};

  for (const w of data.workouts ?? []) {
    try { workouts.push(parseWorkout(w)); }
    catch (e: any) { errors.push(`workout: ${e?.message ?? e}`); }
  }

  for (const metric of data.metrics ?? []) {
    const nm = String(metric?.name ?? "").toLowerCase().replace(/\s+/g, "_");
    const md = metric?.data ?? [];
    if (!md || md.length === 0) continue;
    try {
      if (nm === "sleep_analysis" || nm === "sleep") {
        for (const s of md) sleep.push(parseSleep(s));
      } else if (nm === "heart_rate") {
        const p = parseHeartRate(md, false);
        if (p) restingHr.push(p);
      } else if (nm === "resting_heart_rate") {
        const p = parseHeartRate(md, true);
        if (p) restingHr.push(p);
      } else if (nm === "vo2_max" || nm === "vo2max") {
        vo2Max.push(...parseVO2Max(md));
      }
    } catch (e: any) { errors.push(`${nm}: ${e?.message ?? e}`); }
  }

  // Resolve duplicate resting HR entries per day: keep the lowest (like Python).
  const dedupHr = new Map<string, ParsedRestingHR>();
  for (const p of restingHr) {
    const prev = dedupHr.get(p.log_date);
    if (!prev || p.resting_hr < prev.resting_hr) dedupHr.set(p.log_date, p);
  }

  return {
    workouts,
    sleep,
    resting_hr: Array.from(dedupHr.values()),
    vo2_max: vo2Max,
    errors,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function round(v: number, decimals: number): number {
  const m = 10 ** decimals;
  return Math.round(v * m) / m;
}

/** Parse a Health Auto Export date string ("2026-07-17 14:00:00 -0400") to ISO. */
function parseHAEDate(s: unknown): string | null {
  if (!s || typeof s !== "string") return null;
  // Try ISO first
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso.toISOString();
  // HAE format: "YYYY-MM-DD HH:mm:ss ±HHMM"
  const m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s*([+-]\d{2})(\d{2})?$/);
  if (m) {
    const [, date, time, tzH, tzM = "00"] = m;
    const d = new Date(`${date}T${time}${tzH}:${tzM}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}
