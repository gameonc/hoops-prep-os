import { rapid } from "./base";

/**
 * AirVisual/AirQuality — supports two RapidAPI listing "flavors" plus the
 * official IQAir REST API as a fallback. Set `RAPIDAPI_AIRQUALITY_FLAVOR` to
 * one of:
 *   - "airvisual1"   → apidojo listing (host: airvisual1.p.rapidapi.com; REST paths)
 *   - "raygorodskij" → RPC-style listing (host: airvisual.p.rapidapi.com; RPC)
 *   - "iqair-direct" → bypass RapidAPI, hit api.airvisual.com/v2 directly with IQAIR_KEY
 *
 * All three return a normalized `AirQualityReading`.
 */

const FLAVOR = (process.env.RAPIDAPI_AIRQUALITY_FLAVOR ?? "iqair-direct") as
  | "airvisual1" | "raygorodskij" | "iqair-direct";

const HOST_AIRVISUAL1 = process.env.RAPIDAPI_HOST_AIRVISUAL ?? "airvisual1.p.rapidapi.com";
const HOST_RAYGORODSKIJ = "airvisual.p.rapidapi.com";
const IQAIR_KEY = process.env.IQAIR_KEY ?? "";

export type AirQualityReading = {
  aqi_us: number;
  main_pollutant: string;
  temperature_c?: number;
  humidity?: number;
  wind_kph?: number;
  city?: string;
  country?: string;
};

function normalize(iqairResponse: any): AirQualityReading {
  const p = iqairResponse?.data?.current?.pollution ?? iqairResponse?.current?.pollution ?? {};
  const w = iqairResponse?.data?.current?.weather ?? iqairResponse?.current?.weather ?? {};
  return {
    aqi_us: Number(p.aqius ?? p.aqi ?? 0),
    main_pollutant: String(p.mainus ?? p.main_pollutant ?? "unknown"),
    temperature_c: w.tp ?? w.temperature_c,
    humidity: w.hu ?? w.humidity,
    wind_kph: w.ws != null ? w.ws * 3.6 : w.wind_kph,
    city: iqairResponse?.data?.city ?? iqairResponse?.city,
    country: iqairResponse?.data?.country ?? iqairResponse?.country,
  };
}

export const airQuality = {
  byLatLon: async (lat: number, lon: number): Promise<AirQualityReading> => {
    if (FLAVOR === "iqair-direct") {
      if (!IQAIR_KEY) throw new Error("IQAIR_KEY not set (or switch RAPIDAPI_AIRQUALITY_FLAVOR to a RapidAPI listing).");
      const url = `https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lon}&key=${IQAIR_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`IQAir ${res.status}`);
      return normalize(await res.json());
    }
    if (FLAVOR === "airvisual1") {
      const r = await rapid<any>({
        host: HOST_AIRVISUAL1,
        path: `/v2/nearest_city`,
        query: { lat, lon },
        cacheTtl: 60 * 30,
      });
      return normalize(r);
    }
    // raygorodskij — RPC-style call. TODO: exact HTTP verb/path — verify from your subscribed listing.
    const r = await rapid<any>({
      host: HOST_RAYGORODSKIJ,
      path: `/AirVisual.getNearestCity`,
      method: "POST",
      body: { coordinates: { latitude: lat, longitude: lon }, radius: 1000 },
      cacheTtl: 60 * 30,
    });
    return normalize(r);
  },
};

/** US AQI training-safety bands. */
export function trainingAdviceFromAqi(aqi: number): {
  level: "good" | "moderate" | "sensitive" | "unhealthy" | "very_unhealthy" | "hazardous";
  outdoorSafe: boolean;
  note: string;
} {
  if (aqi <= 50)  return { level: "good",           outdoorSafe: true,  note: "Green light for outdoor conditioning." };
  if (aqi <= 100) return { level: "moderate",       outdoorSafe: true,  note: "Fine for most; ease off if you feel it." };
  if (aqi <= 150) return { level: "sensitive",      outdoorSafe: true,  note: "Sensitive athletes: shorten high-intensity outdoor work." };
  if (aqi <= 200) return { level: "unhealthy",      outdoorSafe: false, note: "Move conditioning indoors." };
  if (aqi <= 300) return { level: "very_unhealthy", outdoorSafe: false, note: "Indoor only. Consider swapping to recovery." };
  return              { level: "hazardous",      outdoorSafe: false, note: "Do not train outdoors. Recovery / mobility only." };
}
