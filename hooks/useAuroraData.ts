"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchAuroraOval,
  fetchCurrentKp,
  fetchKpForecast,
  fetchBz,
  fetchCloudCover,
  fetchSunTimes,
  computeVerdict,
  type AuroraPoint,
  type KpEntry,
  type KpForecastEntry,
  type BzData,
  type CloudHourly,
  type SunTimes,
  type Verdict,
} from "@/lib/api";
import { getDemoData, DEMO_DATE_LABEL } from "@/lib/demoData";

const POLL_INTERVAL = 60_000; // 60 seconds

export interface AuroraData {
  oval: AuroraPoint[];
  kp: KpEntry | null;
  kpForecast: KpForecastEntry[];
  bz: BzData | null;
  cloudCover: CloudHourly | null;
  sunTimes: SunTimes | null;
  verdict: Verdict | null;
  userLocation: { lat: number; lon: number } | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  demoMode: boolean;
  demoDateLabel: string;
  toggleDemo: () => void;
  updateLocation: (lat: number, lon: number) => void;
}

export function useAuroraData(): AuroraData {
  const [oval, setOval] = useState<AuroraPoint[]>([]);
  const [kp, setKp] = useState<KpEntry | null>(null);
  const [kpForecast, setKpForecast] = useState<KpForecastEntry[]>([]);
  const [bz, setBz] = useState<BzData | null>(null);
  const [cloudCover, setCloudCover] = useState<CloudHourly | null>(null);
  const [sunTimes, setSunTimes] = useState<SunTimes | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const locationRef = useRef<{ lat: number; lon: number } | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get user location once — fallback to Rovaniemi, Finland if denied/unavailable
  useEffect(() => {
    const HELSINKI = { lat: 60.17, lon: 24.94 };

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUserLocation(HELSINKI);
      locationRef.current = HELSINKI;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(loc);
        locationRef.current = loc;
      },
      () => {
        setUserLocation(HELSINKI);
        locationRef.current = HELSINKI;
      },
      { timeout: 10000 }
    );
  }, []);

  const loadDemo = useCallback(() => {
    const demo = getDemoData();
    setOval(demo.oval);
    setKp(demo.kp);
    setKpForecast(demo.kpForecast);
    setBz(demo.bz);
    setCloudCover(demo.cloudCover);
    setSunTimes(demo.sunTimes);
    setVerdict(demo.verdict);
    setLastUpdated(new Date("2026-02-06T21:00:00Z"));
    setLoading(false);
    setError(null);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);

      const [ovalData, kpData, kpFcData, bzData] = await Promise.all([
        fetchAuroraOval(),
        fetchCurrentKp(),
        fetchKpForecast(),
        fetchBz(),
      ]);

      setOval(ovalData);
      setKp(kpData);
      setKpForecast(kpFcData);
      setBz(bzData);

      const loc = locationRef.current;
      if (loc) {
        const [cloudData, sunData] = await Promise.all([
          fetchCloudCover(loc.lat, loc.lon),
          fetchSunTimes(loc.lat, loc.lon),
        ]);
        setCloudCover(cloudData);
        setSunTimes(sunData);

        const currentCloud = cloudData.values[0] ?? 50;
        setVerdict(computeVerdict(kpData.kp, bzData.bz, sunData, currentCloud));
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleDemo = useCallback(() => {
    setDemoMode((prev) => {
      const next = !prev;
      if (next) {
        // Entering demo mode — stop polling
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        loadDemo();
      } else {
        // Exiting demo mode — refetch live data and restart polling
        setLoading(true);
        // Wait for location, then fetch
        const checkLoc = setInterval(() => {
          if (locationRef.current) {
            fetchAll();
            clearInterval(checkLoc);
          }
        }, 200);
        pollTimerRef.current = setInterval(fetchAll, POLL_INTERVAL);
      }
      return next;
    });
  }, [loadDemo, fetchAll]);

  const updateLocation = useCallback((lat: number, lon: number) => {
    const loc = { lat, lon };
    setUserLocation(loc);
    locationRef.current = loc;
  }, []);

  // Initial fetch + polling (live mode only)
  useEffect(() => {
    if (demoMode) return;

    const interval = setInterval(() => {
      if (locationRef.current) {
        fetchAll();
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [fetchAll, demoMode]);

  useEffect(() => {
    if (demoMode) return;
    if (!lastUpdated) return;
    pollTimerRef.current = setInterval(fetchAll, POLL_INTERVAL);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchAll, lastUpdated, demoMode]);

  return {
    oval,
    kp,
    kpForecast,
    bz,
    cloudCover,
    sunTimes,
    verdict,
    userLocation,
    loading,
    error,
    lastUpdated,
    demoMode,
    demoDateLabel: DEMO_DATE_LABEL,
    toggleDemo,
    updateLocation,
  };
}
