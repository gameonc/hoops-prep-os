/* Standalone parity test — run with `node --experimental-strip-types <path>`
 * Confirms the TS port produces the same numbers as the Python receiver on
 * the same v2 payload used in the sandbox smoke test.
 */
import { parseHAE } from "./parser";

const SAMPLE = {
  data: {
    workouts: [
      {
        name: "Basketball",
        start: "2026-07-17 14:00:00 -0400",
        end: "2026-07-17 15:30:00 -0400",
        duration: { qty: 5400, units: "s" },
        activeEnergyBurned: { qty: 620, units: "kcal" },
        heartRate: { avg: { qty: 148, units: "bpm" }, max: { qty: 179, units: "bpm" } },
      },
      {
        name: "Traditional Strength Training",
        start: "2026-07-16 07:00:00 -0400",
        end: "2026-07-16 07:50:00 -0400",
        duration: { qty: 3000, units: "s" },
        activeEnergyBurned: { qty: 285, units: "kcal" },
        avgHeartRate: { qty: 122, units: "bpm" },
        maxHeartRate: { qty: 158, units: "bpm" },
      },
    ],
    metrics: [
      { name: "Sleep Analysis", units: "hr", data: [
        { date: "2026-07-17", totalSleep: 7.4, asleep: 7.2, core: 4.1, deep: 1.3, rem: 1.8,
          sleepStart: "2026-07-16 23:15:00 -0400", sleepEnd: "2026-07-17 06:45:00 -0400", inBed: 7.5 }
      ]},
      { name: "Heart Rate", units: "bpm", data: [
        { date: "2026-07-17 06:45:00 -0400", Min: 52, Avg: 68, Max: 179 }
      ]},
      { name: "Resting Heart Rate", units: "bpm", data: [
        { date: "2026-07-17 08:00:00 -0400", qty: 54 }
      ]},
      { name: "VO2 Max", units: "mL/(kg·min)", data: [
        { date: "2026-07-17 08:00:00 -0400", qty: 51.2 }
      ]},
    ],
  },
};

const r = parseHAE(SAMPLE as any);

// Expected outputs (mirror Python round-trip):
const expected = {
  workoutCount: 2,
  sleepCount: 1,
  restingHrCount: 1,
  vo2Count: 1,
  errorsCount: 0,
  basketball: { session_type: "sport", duration_min: 90, rpe: 7, active_calories: 620, avg_hr: 148, max_hr: 179 },
  strength:   { session_type: "strength", duration_min: 50, rpe: 5, active_calories: 285, avg_hr: 122, max_hr: 158 },
  sleep:      { sleep_hours: 7.4, sleep_quality: 4, deep_sleep_min: 78, rem_sleep_min: 108, core_sleep_min: 246 },
  restingHr:  52,           // min of (Min=52, qty=54) since HR metric gives 52 as min
  vo2:        51.2,
};

const errs: string[] = [];
function check(label: string, cond: boolean, got?: unknown, want?: unknown) {
  if (!cond) errs.push(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

check("workoutCount", r.workouts.length === expected.workoutCount, r.workouts.length, expected.workoutCount);
check("sleepCount", r.sleep.length === expected.sleepCount, r.sleep.length, expected.sleepCount);
check("restingHrCount", r.resting_hr.length === expected.restingHrCount, r.resting_hr.length, expected.restingHrCount);
check("vo2Count", r.vo2_max.length === expected.vo2Count, r.vo2_max.length, expected.vo2Count);
check("errorsCount", r.errors.length === expected.errorsCount, r.errors, []);

const b = r.workouts.find(w => w.activity_name === "Basketball")!;
check("basketball.session_type", b?.session_type === expected.basketball.session_type, b?.session_type, expected.basketball.session_type);
check("basketball.duration_min", b?.duration_min === expected.basketball.duration_min, b?.duration_min, expected.basketball.duration_min);
check("basketball.rpe", b?.rpe === expected.basketball.rpe, b?.rpe, expected.basketball.rpe);
check("basketball.active_calories", b?.active_calories === expected.basketball.active_calories, b?.active_calories, expected.basketball.active_calories);
check("basketball.avg_hr", b?.avg_hr === expected.basketball.avg_hr, b?.avg_hr, expected.basketball.avg_hr);
check("basketball.max_hr", b?.max_hr === expected.basketball.max_hr, b?.max_hr, expected.basketball.max_hr);

const s = r.workouts.find(w => w.activity_name === "Traditional Strength Training")!;
check("strength.session_type", s?.session_type === expected.strength.session_type, s?.session_type, expected.strength.session_type);
check("strength.duration_min", s?.duration_min === expected.strength.duration_min, s?.duration_min, expected.strength.duration_min);
check("strength.rpe", s?.rpe === expected.strength.rpe, s?.rpe, expected.strength.rpe);
check("strength.avg_hr", s?.avg_hr === expected.strength.avg_hr, s?.avg_hr, expected.strength.avg_hr);

const sl = r.sleep[0];
check("sleep.hours", sl?.sleep_hours === expected.sleep.sleep_hours, sl?.sleep_hours, expected.sleep.sleep_hours);
check("sleep.quality", sl?.sleep_quality === expected.sleep.sleep_quality, sl?.sleep_quality, expected.sleep.sleep_quality);
check("sleep.deep", sl?.deep_sleep_min === expected.sleep.deep_sleep_min, sl?.deep_sleep_min, expected.sleep.deep_sleep_min);
check("sleep.rem", sl?.rem_sleep_min === expected.sleep.rem_sleep_min, sl?.rem_sleep_min, expected.sleep.rem_sleep_min);
check("sleep.core", sl?.core_sleep_min === expected.sleep.core_sleep_min, sl?.core_sleep_min, expected.sleep.core_sleep_min);

check("resting_hr", r.resting_hr[0]?.resting_hr === expected.restingHr, r.resting_hr[0]?.resting_hr, expected.restingHr);
check("vo2", r.vo2_max[0]?.vo2_max === expected.vo2, r.vo2_max[0]?.vo2_max, expected.vo2);

if (errs.length === 0) {
  console.log("PARITY PASS — all", (r.workouts.length + r.sleep.length + r.resting_hr.length + r.vo2_max.length), "records matched Python output");
  console.log(JSON.stringify(r, null, 2));
} else {
  console.error("PARITY FAIL:");
  for (const e of errs) console.error("  -", e);
  process.exit(1);
}
