// ============================================================
// Demo data for SolarFlair — simulates a strong aurora event
// on 2026-02-06 over Northern Europe / Scandinavia
// ============================================================

import type {
  AuroraPoint,
  KpEntry,
  KpForecastEntry,
  BzData,
  CloudHourly,
  SunTimes,
  Verdict,
} from "@/lib/api";

/* ---------- Aurora Oval (synthetic strong event) ---------- */

function generateDemoOval(): AuroraPoint[] {
  const points: AuroraPoint[] = [];
  // Generate a strong aurora band between lat 50-75, all longitudes
  for (let lon = -180; lon <= 180; lon += 1) {
    for (let lat = 45; lat <= 80; lat += 1) {
      // Aurora probability peaks around 65-70 latitude
      const latCenter = 66;
      const latWidth = 8;
      const distFromCenter = Math.abs(lat - latCenter);
      let prob = 0;

      if (distFromCenter < latWidth) {
        // Bell curve shape
        prob = Math.exp(-0.5 * (distFromCenter / (latWidth * 0.4)) ** 2) * 90;
        // Add some longitude variation for realism
        const lonFactor =
          1 + 0.3 * Math.sin(((lon + 30) * Math.PI) / 60);
        prob *= lonFactor;
        // Add slight randomness (seeded by position for consistency)
        const seed = Math.sin(lat * 12.9898 + lon * 78.233) * 43758.5453;
        const noise = (seed - Math.floor(seed)) * 0.2 - 0.1;
        prob *= 1 + noise;
        prob = Math.max(0, Math.min(100, prob));
      }

      if (prob > 2) {
        points.push({
          lon,
          lat,
          probability: Math.round(prob),
        });
      }
    }
  }
  return points;
}

/* ---------- Kp Data ---------- */

const DEMO_KP: KpEntry = {
  time: "2026-02-06 21:00:00.000",
  kp: 6.33,
};

/* ---------- Kp Forecast ---------- */

function generateDemoKpForecast(): KpForecastEntry[] {
  const entries: KpForecastEntry[] = [];
  const baseDate = new Date("2026-02-06T18:00:00Z");

  // Simulate a storm building, peaking around 21:00-03:00, then fading
  const kpProfile = [
    3.0, 3.5, 4.2, 5.0, 5.8, 6.3, 6.7, 7.0, 7.2, 6.8, 6.3, 5.7,
    5.0, 4.3, 3.8, 3.5, 3.2, 3.0, 2.8, 2.7, 2.5, 2.3, 2.2, 2.0,
  ];

  for (let i = 0; i < kpProfile.length; i++) {
    const t = new Date(baseDate.getTime() + i * 3 * 3600_000);
    entries.push({
      time: t.toISOString().replace("T", " ").replace("Z", ".000"),
      kp: kpProfile[i],
    });
  }

  return entries;
}

/* ---------- Bz ---------- */

const DEMO_BZ: BzData = {
  time: "2026-02-06 21:00:00.000",
  bz: -11.4,
};

/* ---------- Cloud Cover (Rovaniemi area, partly clear) ---------- */

function generateDemoCloudCover(): CloudHourly {
  const hours: string[] = [];
  const values: number[] = [];
  const baseDate = new Date("2026-02-06T00:00:00");

  // 48 hours of cloud data — mostly clear evening/night
  const cloudProfile = [
    65, 60, 55, 50, 45, 40, 35, 30, 28, 25, 22, 20,
    18, 15, 12, 10, 12, 15, 20, 18, 15, 12, 10, 8,
    10, 15, 20, 25, 30, 35, 40, 42, 38, 35, 30, 25,
    22, 20, 18, 15, 12, 10, 15, 20, 25, 30, 35, 40,
  ];

  for (let i = 0; i < 48; i++) {
    const t = new Date(baseDate.getTime() + i * 3600_000);
    hours.push(t.toISOString().slice(0, 16));
    values.push(cloudProfile[i] ?? 30);
  }

  return { hours, values };
}

/* ---------- Sun Times (Rovaniemi, Feb 6) ---------- */

const DEMO_SUN_TIMES: SunTimes = {
  sunrise: "2026-02-06T08:45:00+02:00",
  sunset: "2026-02-06T15:15:00+02:00",
  astronomical_twilight_begin: "2026-02-06T05:45:00+02:00",
  astronomical_twilight_end: "2026-02-06T18:15:00+02:00",
};

/* ---------- Verdict ---------- */

const DEMO_VERDICT: Verdict = {
  label: "Excellent",
  description:
    "G2 geomagnetic storm in progress with clear skies over Lapland. Peak Kp 7+ expected. Go outside now!",
  level: "excellent",
  kp: 6.33,
  bz: -11.4,
  isDark: true,
  darkUntil: "06:00",
};

/* ---------- Export all demo data ---------- */

export const DEMO_DATE_LABEL = "Feb 6, 2026";

export function getDemoData() {
  return {
    oval: generateDemoOval(),
    kp: DEMO_KP,
    kpForecast: generateDemoKpForecast(),
    bz: DEMO_BZ,
    cloudCover: generateDemoCloudCover(),
    sunTimes: DEMO_SUN_TIMES,
    verdict: DEMO_VERDICT,
  };
}
