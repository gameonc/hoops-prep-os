import { rapid } from "./base";

const HOST =
  process.env.RAPIDAPI_HOST_AI_WORKOUT ??
  "ai-workout-planner-exercise-fitness-nutrition-guide.p.rapidapi.com";

/**
 * AI Workout Planner API — VERIFIED LIVE 2026-07-17 against listing `ltdbilgisam`.
 *
 * Response envelope for all endpoints:
 *   { status: "success" | "error", message: string, result: {...}, cacheTime?: number }
 *
 * Verified endpoints:
 *   ✅ generateWorkoutPlan   — full happy path
 *   ✅ customWorkoutPlan     — full happy path (adds `custom_goals`)
 *   ✅ exerciseDetails       — full happy path (POST body, not query)
 *   ⚠️  nutritionAdvice       — 200 OK envelope but inner `result.error` (upstream LLM flaky)
 *   ❌ analyzeFoodPlate       — 400 on `image_url`; alternate field names below
 */

type Envelope<T> = { status: "success" | "error"; message: string; result: T; cacheTime?: number };

export type GeneratePlanInput = {
  goal: string;                         // free-form: "Build muscle","Explosive power","Lose fat",...
  fitness_level: "Beginner" | "Intermediate" | "Advanced";
  preferences: string[];                // ["Weight training","Plyometrics",...]
  health_conditions: string[];          // ["None"] or list
  schedule: { days_per_week: number; session_duration: number }; // minutes
  plan_duration_weeks: number;
  lang?: string;
};

export type CustomPlanInput = GeneratePlanInput & {
  target_muscles: string[];             // free-form: ["glutes","hamstrings","calves"]
  equipment: string[];                  // free-form: ["barbell","dumbbell","body weight"]
};

export type PlanResult = {
  goal: string;
  custom_goals?: string[];              // customWorkoutPlan only
  fitness_level: string;
  total_weeks: number;
  schedule: { days_per_week: number; session_duration: number };
  exercises: Array<{
    day: string;                        // "Monday", "Wednesday", ...
    exercises: Array<{
      name: string;
      duration?: string;                // "45 minutes" | "15 minutes"
      repetitions?: string;             // "8-12" | "3-5 reps"
      sets?: string;                    // "3-4" | "4 sets"
      equipment?: string;
    }>;
  }>;
  seo_title?: string;
  seo_content?: string;
  seo_keywords?: string;
};

export type ExerciseDetailsResult = {
  exercise_name: string;
  description: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment_needed: string[];
  instructions: string[];
  seo_title?: string;
  seo_content?: string;
  seo_keywords?: string;
};

export type NutritionResult = {
  // Happy path shape (best-effort — endpoint frequently returns { error } instead).
  daily_calories?: number;
  macronutrients?: { protein_g?: number; carbs_g?: number; fats_g?: number };
  meal_suggestions?: Array<{ meal?: string; description?: string; calories?: number }>;
  error?: string;                       // set when the upstream LLM couldn't generate
};

export type FoodAnalysisResult = {
  items?: Array<{ name: string; kcal?: number; protein_g?: number; carb_g?: number; fat_g?: number }>;
  totals?: { kcal?: number; protein_g?: number; carb_g?: number; fat_g?: number };
  error?: string;
};

/** Unwraps `{status, message, result}` and throws on inner errors. */
function unwrap<T>(env: Envelope<T> | any): T {
  if (env?.status === "error") {
    throw new Error(`AI Workout Planner error: ${env.message ?? "unknown"}`);
  }
  const inner: any = env?.result ?? env;
  if (inner?.error) {
    throw new Error(`AI Workout Planner inner error: ${inner.error}`);
  }
  return inner as T;
}

export const aiWorkout = {
  generatePlan: async (input: GeneratePlanInput): Promise<PlanResult> => {
    const env = await rapid<Envelope<PlanResult>>({
      host: HOST,
      path: `/generateWorkoutPlan`,
      method: "POST",
      query: { noqueue: 1 },
      body: { lang: "en", ...input },
    });
    return unwrap(env);
  },

  customPlan: async (input: CustomPlanInput): Promise<PlanResult> => {
    const env = await rapid<Envelope<PlanResult>>({
      host: HOST,
      path: `/customWorkoutPlan`,
      method: "POST",
      query: { noqueue: 1 },
      body: { lang: "en", ...input },
    });
    return unwrap(env);
  },

  exerciseDetails: async (exercise_name: string): Promise<ExerciseDetailsResult> => {
    const env = await rapid<Envelope<ExerciseDetailsResult>>({
      host: HOST,
      path: `/exerciseDetails`,
      method: "POST",
      query: { noqueue: 1 },
      body: { exercise_name, lang: "en" },
      cacheTtl: 60 * 60 * 24,             // exercise details are static per name
    });
    return unwrap(env);
  },

  /**
   * WARNING (verified 2026-07-17): the endpoint frequently returns
   *   { status: "success", message: "...", result: { error: "..." } }
   * i.e. HTTP 200 but the upstream LLM couldn't produce output. Callers must
   * catch the throw and degrade gracefully.
   */
  nutritionAdvice: async (body: {
    goal: string;
    dietary_restrictions?: string[];
    current_weight_kg?: number;
    target_weight_kg?: number;
    daily_activity_level?: "sedentary" | "light" | "moderate" | "active" | "very_active";
    lang?: string;
  }): Promise<NutritionResult> => {
    const env = await rapid<Envelope<NutritionResult>>({
      host: HOST,
      path: `/nutritionAdvice`,
      method: "POST",
      query: { noqueue: 1 },
      body: { lang: "en", dietary_restrictions: ["None"], ...body },
    });
    return unwrap(env);
  },

  /**
   * WARNING (verified 2026-07-17): free-tier POST { image_url } → HTTP 400 on
   * this listing. The endpoint likely requires base64 or a different field name
   * — RapidAPI listing doesn't expose the exact schema. We try a matrix of
   * common field names and throw a clear error if none work.
   *
   * If your subscription tier unlocks the endpoint, override
   * `AIW_FOODPLATE_FIELD` env to one of: image_url | image | image_base64 | url | photo_url
   */
  analyzeFoodPlate: async (imageUrl: string): Promise<FoodAnalysisResult> => {
    const override = process.env.AIW_FOODPLATE_FIELD;
    const candidates = override
      ? [override]
      : ["image_url", "image", "image_base64", "url", "photo_url"];

    let lastErr: Error | null = null;
    for (const field of candidates) {
      try {
        const env = await rapid<Envelope<FoodAnalysisResult>>({
          host: HOST,
          path: `/analyzeFoodPlate`,
          method: "POST",
          query: { noqueue: 1 },
          body: { [field]: imageUrl, lang: "en" },
        });
        return unwrap(env);
      } catch (e) {
        lastErr = e as Error;
        // If it's a 4xx, try the next field. If it's a 5xx or network, break.
        if (!/40\d/.test(lastErr.message)) break;
      }
    }
    throw new Error(
      `analyzeFoodPlate failed on all field names (${candidates.join(", ")}). ` +
      `Set AIW_FOODPLATE_FIELD env var to the correct field name for your tier. ` +
      `Last error: ${lastErr?.message ?? "unknown"}`
    );
  },
};

/** Adapter: readiness prescription → AI Workout Planner "goal" string. */
export function toGoal(rxType: string): string {
  return {
    power: "Explosive power",
    strength: "Build strength",
    hypertrophy: "Build muscle",
    conditioning: "Improve endurance",
    recovery: "Recovery",
    shootaround: "Skill maintenance",
    rest: "Recovery",
  }[rxType] ?? "General fitness";
}
