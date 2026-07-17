import { rapid } from "./base";

const HOST = process.env.RAPIDAPI_HOST_EXERCISEDB ?? "exercisedb.p.rapidapi.com";
const KEY = process.env.RAPIDAPI_KEY ?? "";

/**
 * ExerciseDB — verified against vendor docs at edb-docs.up.railway.app (2026-07-17).
 * Note: current-schema exercises may not include gifUrl. To render an animation,
 * use the `/image` endpoint with the exercise `id` (see `exerciseImageUrl` below).
 * Some older listings still return `gifUrl` — we defensively read both.
 */

export type Exercise = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  secondaryMuscles?: string[];
  instructions?: string[];
  description?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  category?: "strength" | "cardio" | "mobility" | "balance" | "stretching" | "plyometrics" | "rehabilitation";
  gifUrl?: string;             // legacy schema — may be undefined
};

/** Cached 6h — the exercise DB is static. */
const TTL = 60 * 60 * 6;

type ListOpts = { limit?: number; offset?: number; sortMethod?: string; sortOrder?: "ascending" | "descending" };

export const exerciseDB = {
  list: (limit = 100) =>
    rapid<Exercise[]>({ host: HOST, path: `/exercises`, query: { limit }, cacheTtl: TTL }),

  byBodyPart: (bodyPart: string, opts: ListOpts = {}) =>
    rapid<Exercise[]>({
      host: HOST,
      path: `/exercises/bodyPart/${encodeURIComponent(bodyPart)}`,
      query: { limit: opts.limit ?? 50, offset: opts.offset ?? 0, sortMethod: opts.sortMethod, sortOrder: opts.sortOrder },
      cacheTtl: TTL,
    }),

  byTarget: (target: string, opts: ListOpts = {}) =>
    rapid<Exercise[]>({
      host: HOST,
      path: `/exercises/target/${encodeURIComponent(target)}`,
      query: { limit: opts.limit ?? 50, offset: opts.offset ?? 0, sortMethod: opts.sortMethod, sortOrder: opts.sortOrder },
      cacheTtl: TTL,
    }),

  byEquipment: (equipment: string, opts: ListOpts = {}) =>
    rapid<Exercise[]>({
      host: HOST,
      path: `/exercises/equipment/${encodeURIComponent(equipment)}`,
      query: { limit: opts.limit ?? 50, offset: opts.offset ?? 0 },
      cacheTtl: TTL,
    }),

  byId: (id: string) =>
    rapid<Exercise>({ host: HOST, path: `/exercises/exercise/${encodeURIComponent(id)}`, cacheTtl: TTL }),

  search: (name: string) =>
    rapid<Exercise[]>({ host: HOST, path: `/exercises/name/${encodeURIComponent(name)}`, cacheTtl: TTL }),

  bodyParts: () => rapid<string[]>({ host: HOST, path: `/exercises/bodyPartList`, cacheTtl: TTL }),
  targets:   () => rapid<string[]>({ host: HOST, path: `/exercises/targetList`,   cacheTtl: TTL }),
  equipment: () => rapid<string[]>({ host: HOST, path: `/exercises/equipmentList`, cacheTtl: TTL }),
};

/**
 * URL to an exercise's animated GIF via the paid /image endpoint.
 * Resolutions: 180 (BASIC), 360 (PRO), 720/1080 (ULTRA/MEGA).
 * We include the key as a query param so <img src=""> works client-side without
 * proxying — the tradeoff is exposing your key in image URLs. Prefer the
 * /api/exercise-image server route below in production.
 */
export function exerciseImageUrl(exerciseId: string, resolution: 180 | 360 | 720 | 1080 = 360) {
  return `https://${HOST}/image?exerciseId=${encodeURIComponent(exerciseId)}&resolution=${resolution}&rapidapi-key=${encodeURIComponent(KEY)}`;
}

/** Get a display URL for an exercise — prefer legacy gifUrl if present, else the image endpoint. */
export function displayImageForExercise(e: Exercise, resolution: 180 | 360 | 720 | 1080 = 360): string {
  return e.gifUrl ?? `/api/exercise-image?id=${encodeURIComponent(e.id)}&resolution=${resolution}`;
}

/**
 * Basketball-relevant filter.
 * ExerciseDB target values are lowercase and (mostly) singular.
 */
export const BBALL_TARGETS = new Set([
  "glutes","quads","hamstrings","calves","adductors","abductors",
  "abs","spine","serratus anterior",
  "delts","lats","upper back","traps","pectorals","biceps","triceps","forearms",
]);

export function filterForBasketball(list: Exercise[]): Exercise[] {
  return list.filter((e) => BBALL_TARGETS.has((e.target ?? "").toLowerCase()));
}
