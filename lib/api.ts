// ============================================================
// SolarFlair — API layer
// All NOAA / Open-Meteo / Sunrise-Sunset fetch helpers, types,
// aurora grid helpers, geo utilities, and verdict logic.
// ============================================================

/* ---------- Types ---------- */

export interface AuroraPoint {
  lon: number;
  lat: number;
  probability: number;
}

export interface KpEntry {
  time: string;
  kp: number;
}

export interface KpForecastEntry {
  time: string;
  kp: number;
}

export interface BzData {
  time: string;
  bz: number;
}

export interface CloudHourly {
  hours: string[];
  values: number[];
}

export interface SunTimes {
  sunrise: string;
  sunset: string;
  astronomical_twilight_begin: string;
  astronomical_twilight_end: string;
}

export interface Verdict {
  label: string;
  description: string;
  level: "excellent" | "good" | "moderate" | "poor" | "none";
  kp: number;
  bz: number;
  isDark: boolean;
  darkUntil?: string;
}

export interface ViewportCloudGrid {
  points: { lat: number; lon: number; hours: number[] }[];
  fetchedAt: number;
}

/* ---------- API Fetchers ---------- */

export async function fetchAuroraOval(): Promise<AuroraPoint[]> {
  const res = await fetch(
    "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json",
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch aurora data");
  const data = await res.json();

  const coords: [number, number, number][] = data.coordinates ?? data;
  return coords
    .filter(([, lat, prob]) => lat > 40 && prob > 0)
    .map(([rawLon, lat, prob]) => ({
      lon: rawLon > 180 ? rawLon - 360 : rawLon,
      lat,
      probability: prob,
    }));
}

export async function fetchCurrentKp(): Promise<KpEntry> {
  const res = await fetch(
    "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch Kp");
  const data: string[][] = await res.json();
  const last = data[data.length - 1];
  return { time: last[0], kp: parseFloat(last[1]) };
}

export async function fetchKpForecast(): Promise<KpForecastEntry[]> {
  const res = await fetch(
    "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch Kp forecast");
  const data: string[][] = await res.json();
  return data.slice(1).map((row) => ({
    time: row[0],
    kp: parseFloat(row[1]),
  }));
}

export async function fetchBz(): Promise<BzData> {
  const res = await fetch(
    "https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json",
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch Bz");
  const data: string[][] = await res.json();
  const last = data[data.length - 1];
  return { time: last[0], bz: parseFloat(last[3]) };
}

export async function fetchCloudCover(
  lat: number,
  lon: number
): Promise<CloudHourly> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=cloud_cover&forecast_days=2`
  );
  if (!res.ok) throw new Error("Failed to fetch cloud cover");
  const data = await res.json();
  return {
    hours: data.hourly.time,
    values: data.hourly.cloud_cover,
  };
}

export async function fetchViewportClouds(
  points: { lat: number; lon: number }[]
): Promise<ViewportCloudGrid> {
  const capped = points.slice(0, 50);
  const lats = capped.map((p) => p.lat).join(",");
  const lons = capped.map((p) => p.lon).join(",");
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=cloud_cover&forecast_days=2`
  );
  if (!res.ok) throw new Error("Failed to fetch viewport clouds");
  const data = await res.json();
  const results = Array.isArray(data) ? data : [data];
  return {
    points: results.map((r: { hourly: { time: string[]; cloud_cover: number[] } }, i: number) => ({
      lat: capped[i].lat,
      lon: capped[i].lon,
      hours: r.hourly.cloud_cover,
    })),
    fetchedAt: Date.now(),
  };
}

export async function fetchSunTimes(
  lat: number,
  lon: number
): Promise<SunTimes> {
  const res = await fetch(
    `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`
  );
  if (!res.ok) throw new Error("Failed to fetch sun times");
  const data = await res.json();
  return data.results;
}

/* ---------- Aurora Grid Helpers ---------- */

export function sampleAuroraAt(
  oval: AuroraPoint[],
  lat: number,
  lon: number
): number {
  // Bilinear interpolation from 1° grid
  const gridLat = Math.floor(lat);
  const gridLon = Math.floor(lon);
  const fracLat = lat - gridLat;
  const fracLon = lon - gridLon;

  const get = (la: number, lo: number) =>
    oval.find((p) => Math.abs(p.lat - la) < 0.5 && Math.abs(p.lon - lo) < 0.5)
      ?.probability ?? 0;

  const v00 = get(gridLat, gridLon);
  const v10 = get(gridLat + 1, gridLon);
  const v01 = get(gridLat, gridLon + 1);
  const v11 = get(gridLat + 1, gridLon + 1);

  const top = v00 * (1 - fracLon) + v01 * fracLon;
  const bot = v10 * (1 - fracLon) + v11 * fracLon;
  return top * (1 - fracLat) + bot * fracLat;
}

/* ---------- Kp Interpolation ---------- */

export function getKpAtTime(
  forecast: KpForecastEntry[],
  currentKp: number,
  targetTime: Date
): number {
  if (forecast.length === 0) return currentKp;

  const target = targetTime.getTime();
  const firstFc = new Date(forecast[0].time).getTime();
  if (target <= firstFc) return currentKp;

  for (let i = 0; i < forecast.length - 1; i++) {
    const t0 = new Date(forecast[i].time).getTime();
    const t1 = new Date(forecast[i + 1].time).getTime();
    if (target >= t0 && target <= t1) {
      const frac = (target - t0) / (t1 - t0);
      return forecast[i].kp + frac * (forecast[i + 1].kp - forecast[i].kp);
    }
  }

  return forecast[forecast.length - 1].kp;
}

export function getKpScale(currentKp: number, forecastKp: number): number {
  return Math.min(3, forecastKp / Math.max(0.5, currentKp));
}

export function getMinAuroraLat(kp: number): number {
  return Math.max(30, 67 - 3 * kp);
}

/* ---------- Solar Elevation & Darkness ---------- */

export function solarElevation(
  lat: number,
  lon: number,
  date: Date
): number {
  const rad = Math.PI / 180;
  const dayOfYear =
    Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
    );
  const declination = 23.45 * Math.sin(rad * ((360 / 365) * (dayOfYear - 81)));
  const hourAngle =
    ((date.getUTCHours() + date.getUTCMinutes() / 60) / 24) * 360 -
    180 +
    lon;
  const sinElev =
    Math.sin(lat * rad) * Math.sin(declination * rad) +
    Math.cos(lat * rad) *
      Math.cos(declination * rad) *
      Math.cos(hourAngle * rad);
  return Math.asin(sinElev) / rad;
}

export function darknessFactor(lat: number, lon: number, date: Date): number {
  const elev = solarElevation(lat, lon, date);
  if (elev > 0) return 0; // daylight
  if (elev > -6) return 0.3 * (-elev / 6); // civil twilight
  if (elev > -18) return 0.3 + 0.7 * ((-elev - 6) / 12); // nautical/astro
  return 1; // full night
}

/* ---------- Verdict Logic ---------- */

export function computeVerdict(
  kp: number,
  bz: number,
  sunTimes: SunTimes | null,
  cloudPercent: number
): Verdict {
  const now = new Date();
  let isDark = true;
  let darkUntil: string | undefined;

  if (sunTimes) {
    const sunrise = new Date(sunTimes.sunrise);
    const sunset = new Date(sunTimes.sunset);
    const astEnd = new Date(sunTimes.astronomical_twilight_end);

    if (now > sunrise && now < sunset) {
      isDark = false;
    }
    if (isDark && astEnd) {
      darkUntil = astEnd.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  if (!isDark) {
    return {
      label: "Too Bright",
      description: "Wait for darkness to view the aurora.",
      level: "none",
      kp,
      bz,
      isDark,
    };
  }

  if (kp >= 5 && bz < -5 && cloudPercent < 40) {
    return {
      label: "Excellent",
      description: "Geomagnetic storm with clear skies. Go outside now!",
      level: "excellent",
      kp,
      bz,
      isDark,
      darkUntil,
    };
  }

  if (kp >= 4 && cloudPercent < 50) {
    return {
      label: "Good",
      description: "Strong geomagnetic activity with favorable conditions.",
      level: "good",
      kp,
      bz,
      isDark,
      darkUntil,
    };
  }

  if (kp >= 3) {
    return {
      label: "Moderate",
      description: "Some activity detected. Watch for changes.",
      level: "moderate",
      kp,
      bz,
      isDark,
      darkUntil,
    };
  }

  return {
    label: "Low",
    description: "Geomagnetic activity is quiet. Aurora unlikely at mid-latitudes.",
    level: "poor",
    kp,
    bz,
    isDark,
    darkUntil,
  };
}

/* ---------- Geo Utilities ---------- */

export function destinationPoint(
  lat: number,
  lon: number,
  bearing: number,
  distance: number
): { lat: number; lon: number } {
  const R = 6371;
  const rad = Math.PI / 180;
  const lat1 = lat * rad;
  const lon1 = lon * rad;
  const brng = bearing * rad;
  const d = distance / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { lat: lat2 / rad, lon: lon2 / rad };
}

/* ---------- Color Ramps ---------- */

export function auroraColor(
  value: number
): [number, number, number, number] {
  // 0–0.15: Cyan-green, 0.15–0.35: Green→Purple, 0.35–1: Purple→Magenta
  let r: number, g: number, b: number;
  if (value < 0.15) {
    const t = value / 0.15;
    r = 0;
    g = Math.round(180 + t * 75);
    b = Math.round(200 * (1 - t));
  } else if (value < 0.35) {
    const t = (value - 0.15) / 0.2;
    r = Math.round(t * 160);
    g = Math.round(255 * (1 - t * 0.6));
    b = Math.round(t * 200);
  } else {
    const t = (value - 0.35) / 0.65;
    r = Math.round(160 + t * 95);
    g = Math.round(102 * (1 - t));
    b = Math.round(200 + t * 55);
  }
  const a = Math.min(255, Math.round(value * 350));
  return [r, g, b, a];
}
