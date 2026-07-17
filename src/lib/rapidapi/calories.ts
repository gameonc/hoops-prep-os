import { rapid } from "./base";

const HOST = process.env.RAPIDAPI_HOST_CALORIES ?? "calories-burned-by-api-ninjas.p.rapidapi.com";

export type CaloriesBurnedRow = {
  name: string;
  calories_per_hour: number;
  duration_minutes: number;
  total_calories: number;
};

export const calories = {
  forActivity: (activity: string, weightKg: number, durationMin: number) =>
    rapid<CaloriesBurnedRow[]>({
      host: HOST,
      path: `/v1/caloriesburned`,
      query: {
        activity,
        weight: Math.round(weightKg * 2.20462), // API expects lb
        duration: durationMin,
      },
      cacheTtl: 60 * 60 * 24,
    }),
};
