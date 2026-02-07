"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type {
  AuroraPoint,
  KpForecastEntry,
  CloudHourlyGrid,
} from "@/lib/api";
import {
  sampleAuroraAt,
  getKpAtTime,
  getKpScale,
  getMinAuroraLat,
  darknessFactor,
  auroraColor,
  fetchCloudHourlyGrid,
  destinationPoint,
} from "@/lib/api";
import { sampleLpSync, prefetchTilesForBounds, sampleLpAsync, bortleLabel } from "@/lib/lpTiles";
import {
  Layers,
  Eye,
  Cloud,
  Moon,
  Lightbulb,
  MapPin,
  Navigation,
  Clock,
} from "lucide-react";

// ---- Types ----
type ViewMode = "aggregate" | "aurora" | "clouds" | "darkness" | "lightpollution";

interface AuroraMapProps {
  oval: AuroraPoint[];
  kp: number;
  kpForecast: KpForecastEntry[];
  userLocation: { lat: number; lon: number } | null;
}

interface SpotResult {
  lat: number;
  lon: number;
  aurora: number;
  bortle: number;
  score: number;
}

// ---- Cloud hour index: find the closest matching hour in the times array ----
function getCloudHourIdx(times: string[], hourOffset: number): number {
  if (times.length === 0) return 0;
  const target = Date.now() + hourOffset * 3600_000;
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ---- Component ----
export function AuroraMap({
  oval,
  kp,
  kpForecast,
  userLocation,
}: AuroraMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cloudGridRef = useRef<CloudHourlyGrid | null>(null);
  const lastCloudFetchRef = useRef(0);
  const cloudFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spotLayerRef = useRef<any>(null);
  const drawTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("aggregate");
  const [timeOffset, setTimeOffset] = useState(0); // hours from now
  const [layerToggles, setLayerToggles] = useState({
    clouds: true,
    lightPollution: true,
  });
  const [spotDistance, setSpotDistance] = useState<number | null>(null);
  const [bestSpot, setBestSpot] = useState<SpotResult | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Load Leaflet dynamically (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadLeaflet = async () => {
      if (!(window as Record<string, unknown>).L) {
        // Add CSS
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);

        // Add JS
        await new Promise<void>((resolve) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }
      setLeafletLoaded(true);
    };

    loadLeaflet();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    const map = L.map(mapContainerRef.current, {
      center: userLocation
        ? [userLocation.lat, userLocation.lon]
        : [66.5039, 25.7294],
      zoom: 4,
      minZoom: 3,
      maxZoom: 12,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    // Create canvas overlay
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.mixBlendMode = "screen";
    canvas.style.zIndex = "400";
    map.getContainer().appendChild(canvas);
    canvasRef.current = canvas;

    // Create tooltip div
    const tooltip = document.createElement("div");
    tooltip.style.cssText = `
      position: absolute; z-index: 1000; pointer-events: none;
      background: hsl(220, 18%, 10%); border: 1px solid hsl(220, 15%, 22%);
      border-radius: 8px; padding: 10px 12px; font-size: 12px;
      color: hsl(210, 20%, 92%); display: none; min-width: 180px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      font-family: var(--font-inter), system-ui, sans-serif;
    `;
    map.getContainer().appendChild(tooltip);
    tooltipRef.current = tooltip;

    // Spot finder layer group
    spotLayerRef.current = L.layerGroup().addTo(map);

    // User location marker
    if (userLocation) {
      const userIcon = L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;background:hsl(160,80%,50%);border-radius:50%;border:2px solid hsl(220,18%,10%);box-shadow:0 0 10px hsl(160,80%,50%,0.5);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
        .addTo(map)
        .bindTooltip("Your location", {
          permanent: false,
          direction: "top",
          offset: [0, -8],
        });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletLoaded]);

  // Cloud grid fetcher — builds a structured 7×7 grid for bilinear interpolation
  const fetchCloudGrid = useCallback(async () => {
    if (!mapRef.current) return;
    const now = Date.now();
    if (now - lastCloudFetchRef.current < 30_000) return;
    lastCloudFetchRef.current = now;

    const bounds = mapRef.current.getBounds();
    const south = Math.max(-90, bounds.getSouth());
    const north = Math.min(90, bounds.getNorth());
    const west = Math.max(-180, bounds.getWest());
    const east = Math.min(180, bounds.getEast());

    const GRID_DIVISIONS = 6;
    const latStep = (north - south) / GRID_DIVISIONS;
    const lonStep = (east - west) / GRID_DIVISIONS;

    const gridLats: number[] = [];
    const gridLons: number[] = [];
    for (let i = 0; i <= GRID_DIVISIONS; i++) {
      gridLats.push(Math.round((south + latStep * i) * 100) / 100);
      gridLons.push(Math.round((west + lonStep * i) * 100) / 100);
    }

    try {
      const grid = await fetchCloudHourlyGrid(gridLats, gridLons);
      cloudGridRef.current = grid;
    } catch {
      // Silently fail for cloud grid
    }
  }, []);

  // Sample cloud at a point using bilinear interpolation over the structured grid
  const sampleCloudAt = useCallback(
    (lat: number, lon: number, hourIdx: number): number => {
      const grid = cloudGridRef.current;
      if (!grid || grid.gridLats.length < 2 || grid.gridLons.length < 2) return 50;

      const { gridLats, gridLons, lookup } = grid;

      // Clamp to grid extents
      const cLat = Math.max(gridLats[0], Math.min(gridLats[gridLats.length - 1], lat));
      const cLon = Math.max(gridLons[0], Math.min(gridLons[gridLons.length - 1], lon));

      // Find bounding cell indices
      let li = gridLats.length - 2;
      for (let i = 0; i < gridLats.length - 1; i++) {
        if (gridLats[i + 1] >= cLat) { li = i; break; }
      }
      let lj = gridLons.length - 2;
      for (let i = 0; i < gridLons.length - 1; i++) {
        if (gridLons[i + 1] >= cLon) { lj = i; break; }
      }

      const latLow = gridLats[li];
      const latHigh = gridLats[li + 1];
      const lonLow = gridLons[lj];
      const lonHigh = gridLons[lj + 1];

      const tLat = latHigh !== latLow ? (cLat - latLow) / (latHigh - latLow) : 0;
      const tLon = lonHigh !== lonLow ? (cLon - lonLow) / (lonHigh - lonLow) : 0;

      const Q = (la: number, lo: number): number => {
        const key = `${la.toFixed(2)},${lo.toFixed(2)}`;
        const hours = lookup[key];
        if (!hours) return 50;
        return hours[Math.max(0, Math.min(hourIdx, hours.length - 1))] ?? 50;
      };

      return (
        Q(latLow, lonLow) * (1 - tLat) * (1 - tLon) +
        Q(latHigh, lonLow) * tLat * (1 - tLon) +
        Q(latLow, lonHigh) * (1 - tLat) * tLon +
        Q(latHigh, lonHigh) * tLat * tLon
      );
    },
    []
  );

  // Draw overlay
  const drawOverlay = useCallback(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas || oval.length === 0) return;

    const size = map.getSize();
    const w = Math.floor(size.x / 4);
    const h = Math.floor(size.y / 4);

    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;

    // Offscreen canvas at 25% resolution (reused across frames)
    let offscreen = offscreenRef.current;
    if (!offscreen) {
      offscreen = document.createElement("canvas");
      offscreenRef.current = offscreen;
    }
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    const imageData = offCtx.createImageData(w, h);
    const pixels = imageData.data;

    const targetTime = new Date(Date.now() + timeOffset * 3600_000);
    const forecastKp = getKpAtTime(kpForecast, kp, targetTime);
    const kpScale = timeOffset > 0 ? getKpScale(kp, forecastKp) : 1;
    const minLat = getMinAuroraLat(forecastKp);
    const cloudHourIdx = cloudGridRef.current?.times
      ? getCloudHourIdx(cloudGridRef.current.times, timeOffset)
      : timeOffset;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Map pixel to lat/lon
        const containerPt = {
          x: (x / w) * size.x,
          y: (y / h) * size.y,
        } as [number, number];
        const latlng = map.containerPointToLatLng(containerPt);
        const lat = latlng.lat;
        const lon = latlng.lng;

        const idx = (y * w + x) * 4;

        if (viewMode === "aggregate" || viewMode === "aurora") {
          // Aurora probability
          let prob = sampleAuroraAt(oval, lat, lon);
          prob = Math.min(100, prob * kpScale);

          // Latitude fade
          if (lat < minLat) {
            const fade = Math.max(0, 1 - (minLat - lat) / 5);
            prob *= fade;
          }

          if (viewMode === "aggregate") {
            const clearSky = layerToggles.clouds
              ? 1 - sampleCloudAt(lat, lon, cloudHourIdx) / 100
              : 1;
            const dark = darknessFactor(lat, lon, targetTime);
            const lp = layerToggles.lightPollution
              ? (sampleLpSync(lat, lon)?.factor ?? 1)
              : 1;
            const visibility = (prob / 100) * clearSky * dark * lp;
            const [r, g, b, a] = auroraColor(visibility);
            pixels[idx] = r;
            pixels[idx + 1] = g;
            pixels[idx + 2] = b;
            pixels[idx + 3] = a;
          } else {
            const [r, g, b, a] = auroraColor(prob / 100);
            pixels[idx] = r;
            pixels[idx + 1] = g;
            pixels[idx + 2] = b;
            pixels[idx + 3] = a;
          }
        } else if (viewMode === "clouds") {
          const cloud = sampleCloudAt(lat, lon, cloudHourIdx);
          if (cloud < 5) continue; // effectively clear — skip
          const t = cloud / 100;
          // Cyan-green → warm white → amber
          let r: number, g: number, b: number;
          if (t < 0.3) {
            const f = t / 0.3;
            r = Math.round(40 + f * 60);    // 40 → 100
            g = Math.round(180 + f * 40);   // 180 → 220
            b = Math.round(140 + f * 60);   // 140 → 200
          } else if (t < 0.6) {
            const f = (t - 0.3) / 0.3;
            r = Math.round(100 + f * 100);  // 100 → 200
            g = Math.round(220 - f * 40);   // 220 → 180
            b = Math.round(200 - f * 100);  // 200 → 100
          } else {
            const f = (t - 0.6) / 0.4;
            r = Math.round(200 + f * 40);   // 200 → 240
            g = Math.round(180 - f * 40);   // 180 → 140
            b = Math.round(100 - f * 40);   // 100 → 60
          }
          const alpha = Math.round((0.1 + t * 0.55) * 255);
          pixels[idx] = r;
          pixels[idx + 1] = g;
          pixels[idx + 2] = b;
          pixels[idx + 3] = alpha;
        } else if (viewMode === "darkness") {
          const dark = darknessFactor(lat, lon, targetTime);
          const daylight = 1 - dark;
          if (daylight > 0.01) {
            let r: number, g: number, b: number;
            if (daylight < 0.3) {
              r = Math.round(100 * daylight / 0.3);
              g = Math.round(60 * daylight / 0.3);
              b = Math.round(140 * daylight / 0.3);
            } else if (daylight < 0.7) {
              const f = (daylight - 0.3) / 0.4;
              r = Math.round(100 + f * 155);
              g = Math.round(60 + f * 100);
              b = Math.round(140 - f * 100);
            } else {
              const f = (daylight - 0.7) / 0.3;
              r = 255;
              g = Math.round(160 + f * 60);
              b = Math.round(40 + f * 30);
            }
            pixels[idx] = r;
            pixels[idx + 1] = g;
            pixels[idx + 2] = b;
            pixels[idx + 3] = Math.round(daylight * 200);
          }
        } else if (viewMode === "lightpollution") {
          if (lat >= -65 && lat <= 75) {
            const lp = sampleLpSync(lat, lon);
            if (lp) {
              const t = 1 - lp.factor; // high LP = high t
              let r: number, g: number, b: number;
              if (t < 0.2) {
                r = Math.round(20 + t * 5 * 30);
                g = Math.round(30 + t * 5 * 60);
                b = Math.round(100 + t * 5 * 50);
              } else if (t < 0.5) {
                const f = (t - 0.2) / 0.3;
                r = Math.round(50 + f * 100);
                g = Math.round(90 + f * 110);
                b = Math.round(150 - f * 50);
              } else if (t < 0.8) {
                const f = (t - 0.5) / 0.3;
                r = Math.round(150 + f * 80);
                g = Math.round(200 - f * 40);
                b = Math.round(100 - f * 70);
              } else {
                const f = (t - 0.8) / 0.2;
                r = Math.round(230 + f * 25);
                g = Math.round(160 - f * 80);
                b = Math.round(30 - f * 20);
              }
              pixels[idx] = r;
              pixels[idx + 1] = g;
              pixels[idx + 2] = b;
              pixels[idx + 3] = Math.round(t * 200 + 30);
            }
          }
        }
      }
    }

    offCtx.putImageData(imageData, 0, 0);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size.x, size.y);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (viewMode === "clouds") {
      // Clouds: sharp upscale first, then soft blur glow on top
      ctx.drawImage(offscreen, 0, 0, size.x, size.y);
      ctx.save();
      ctx.filter = "blur(4px)";
      ctx.globalAlpha = 0.4;
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
    } else {
      // Aurora / aggregate / other: glow pass then sharp pass
      ctx.save();
      const blurSize =
        viewMode === "aggregate" || viewMode === "aurora" ? 8 : 4;
      ctx.filter = `blur(${blurSize}px)`;
      ctx.globalAlpha =
        viewMode === "aggregate" || viewMode === "aurora" ? 0.6 : 0.5;
      ctx.drawImage(offscreen, 0, 0, size.x, size.y);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha =
        viewMode === "aggregate" || viewMode === "aurora" ? 0.5 : 0.6;
      ctx.drawImage(offscreen, 0, 0, size.x, size.y);
      ctx.restore();
    }
  }, [
    oval,
    kp,
    kpForecast,
    viewMode,
    timeOffset,
    layerToggles,
    sampleCloudAt,
  ]);

  // Redraw on map events
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !leafletLoaded) return;

    const handleDraw = () => {
      // Quick redraw with existing data (100ms debounce)
      if (drawTimeoutRef.current) clearTimeout(drawTimeoutRef.current);
      drawTimeoutRef.current = setTimeout(() => {
        drawOverlay();
        // Prefetch LP tiles
        const bounds = map.getBounds();
        prefetchTilesForBounds(
          bounds.getSouth(),
          bounds.getWest(),
          bounds.getNorth(),
          bounds.getEast()
        );
      }, 100);

      // Cloud fetch with longer debounce (1500ms) to avoid excessive requests
      if (cloudFetchTimeoutRef.current) clearTimeout(cloudFetchTimeoutRef.current);
      cloudFetchTimeoutRef.current = setTimeout(async () => {
        await fetchCloudGrid();
        drawOverlay(); // Redraw with fresh cloud data
      }, 1500);
    };

    map.on("moveend", handleDraw);
    map.on("zoomend", handleDraw);
    map.on("resize", handleDraw);

    // Initial draw
    handleDraw();

    return () => {
      map.off("moveend", handleDraw);
      map.off("zoomend", handleDraw);
      map.off("resize", handleDraw);
      if (cloudFetchTimeoutRef.current) clearTimeout(cloudFetchTimeoutRef.current);
    };
  }, [leafletLoaded, drawOverlay, fetchCloudGrid]);

  // Redraw when parameters change
  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // Tooltip on mousemove
  useEffect(() => {
    const map = mapRef.current;
    const tooltip = tooltipRef.current;
    if (!map || !tooltip || !leafletLoaded) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseMove = (e: any) => {
      const { lat, lng: lon } = e.latlng;
      const containerPt = e.containerPoint;
      const mapSize = map.getSize();

      // Position tooltip (flip near edges)
      const flipX = containerPt.x > mapSize.x - 220;
      const flipY = containerPt.y > mapSize.y - 150;
      tooltip.style.left = flipX
        ? `${containerPt.x - 200}px`
        : `${containerPt.x + 16}px`;
      tooltip.style.top = flipY
        ? `${containerPt.y - 130}px`
        : `${containerPt.y + 16}px`;
      tooltip.style.display = "block";

      // Sample data
      const targetTime = new Date(Date.now() + timeOffset * 3600_000);
      const forecastKp = getKpAtTime(kpForecast, kp, targetTime);
      const kpScale = timeOffset > 0 ? getKpScale(kp, forecastKp) : 1;
      const cloudHourIdx = cloudGridRef.current?.times
        ? getCloudHourIdx(cloudGridRef.current.times, timeOffset)
        : timeOffset;

      let prob = sampleAuroraAt(oval, lat, lon);
      prob = Math.min(100, prob * kpScale);
      const cloud = sampleCloudAt(lat, lon, cloudHourIdx);
      const dark = darknessFactor(lat, lon, targetTime);
      const lp = sampleLpSync(lat, lon);
      const clearSky = 1 - cloud / 100;
      const visibility = (prob / 100) * clearSky * dark * (lp?.factor ?? 1);

      const probColor =
        prob > 20 ? "#34d399" : prob > 5 ? "#fbbf24" : "#6b7280";
      const cloudColor =
        cloud < 30 ? "#34d399" : cloud < 60 ? "#fbbf24" : "#f97316";
      const darkLabel =
        dark > 0.8
          ? "Full night"
          : dark > 0.3
            ? "Twilight"
            : dark > 0
              ? "Civil twilight"
              : "Daylight";
      const darkColor = dark > 0.5 ? "#34d399" : dark > 0 ? "#fbbf24" : "#f97316";

      let html = `
        <div style="margin-bottom:6px;font-size:11px;color:#6b7280;">
          ${lat.toFixed(2)}, ${lon.toFixed(2)}
          ${timeOffset > 0 ? `<span style="margin-left:6px;padding:1px 6px;background:hsl(220,15%,16%);border-radius:4px;font-size:10px;">Forecast: +${timeOffset}h (Kp ${forecastKp.toFixed(1)})</span>` : ""}
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span>Aurora</span>
          <span style="color:${probColor};font-weight:600;">${prob.toFixed(1)}%</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span>Clouds</span>
          <span style="color:${cloudColor};">${Math.round(cloud)}%</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span>Darkness</span>
          <span style="color:${darkColor};">${darkLabel}</span>
        </div>
      `;

      if (lp) {
        const lpColor =
          lp.bortle <= 3
            ? "#34d399"
            : lp.bortle <= 5
              ? "#fbbf24"
              : "#f97316";
        html += `
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span>Light Poll.</span>
            <span style="color:${lpColor};">Bortle ${lp.bortle}</span>
          </div>
        `;
      }

      html += `
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid hsl(220,15%,22%);display:flex;justify-content:space-between;font-weight:600;">
          <span>Visibility</span>
          <span style="color:${visibility > 0.2 ? "#34d399" : visibility > 0.05 ? "#fbbf24" : "#6b7280"}">${(visibility * 100).toFixed(1)}%</span>
        </div>
      `;

      tooltip.innerHTML = html;
    };

    const handleMouseOut = () => {
      tooltip.style.display = "none";
    };

    map.on("mousemove", handleMouseMove);
    map.on("mouseout", handleMouseOut);

    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("mouseout", handleMouseOut);
    };
  }, [leafletLoaded, oval, kp, kpForecast, timeOffset, sampleCloudAt]);

  // Spot finder
  const findBestSpot = useCallback(
    async (maxDistance: number) => {
      if (!userLocation) return;

      const bearings = Array.from({ length: 12 }, (_, i) => i * 30);
      const fractions = [0.25, 0.5, 0.75, 1.0];
      const candidates: { lat: number; lon: number }[] = [
        { lat: userLocation.lat, lon: userLocation.lon },
      ];

      for (const bearing of bearings) {
        for (const frac of fractions) {
          candidates.push(
            destinationPoint(
              userLocation.lat,
              userLocation.lon,
              bearing,
              maxDistance * frac
            )
          );
        }
      }

      let bestScore = -1;
      let best: SpotResult | null = null;

      for (const c of candidates) {
        const aurora = sampleAuroraAt(oval, c.lat, c.lon);
        const lpData = await sampleLpAsync(c.lat, c.lon);
        const score = (aurora / 100) * 0.6 + lpData.factor * 0.4;
        if (score > bestScore) {
          bestScore = score;
          best = {
            lat: c.lat,
            lon: c.lon,
            aurora,
            bortle: lpData.bortle,
            score,
          };
        }
      }

      setBestSpot(best);

      // Draw on map
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L;
      const layer = spotLayerRef.current;
      if (layer && best) {
        layer.clearLayers();

        // Search radius circle
        L.circle([userLocation.lat, userLocation.lon], {
          radius: maxDistance * 1000,
          color: "hsl(160, 80%, 50%)",
          weight: 1.5,
          dashArray: "6 4",
          fillOpacity: 0.02,
          opacity: 0.3,
        }).addTo(layer);

        // Route line
        L.polyline(
          [
            [userLocation.lat, userLocation.lon],
            [best.lat, best.lon],
          ],
          {
            color: "hsl(160, 80%, 50%)",
            weight: 2,
            dashArray: "8 6",
            opacity: 0.6,
          }
        ).addTo(layer);

        // Best spot marker
        const spotIcon = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;background:hsl(160,80%,50%);border-radius:50%;border:2px solid hsl(220,18%,10%);box-shadow:0 0 16px hsl(160,80%,50%,0.6);"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([best.lat, best.lon], { icon: spotIcon })
          .addTo(layer)
          .bindTooltip(
            `Aurora: ${best.aurora.toFixed(1)}% | ${bortleLabel(best.bortle)} (Bortle ${best.bortle})`,
            { permanent: false, direction: "top", offset: [0, -10] }
          );
      }
    },
    [oval, userLocation]
  );

  // Handle spot distance change
  useEffect(() => {
    if (spotDistance !== null) {
      findBestSpot(spotDistance);
    } else {
      spotLayerRef.current?.clearLayers();
      setBestSpot(null);
    }
  }, [spotDistance, findBestSpot]);

  // ---- UI ----
  const viewModes: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: "aggregate", label: "All", icon: <Eye className="h-3.5 w-3.5" /> },
    {
      id: "aurora",
      label: "Aurora",
      icon: <Layers className="h-3.5 w-3.5" />,
    },
    { id: "clouds", label: "Clouds", icon: <Cloud className="h-3.5 w-3.5" /> },
    {
      id: "darkness",
      label: "Dark",
      icon: <Moon className="h-3.5 w-3.5" />,
    },
    {
      id: "lightpollution",
      label: "LP",
      icon: <Lightbulb className="h-3.5 w-3.5" />,
    },
  ];

  const distancePresets = [
    { label: "10 km", value: 10 },
    { label: "100 km", value: 100 },
    { label: "1000 km", value: 1000 },
  ];

  const targetTime = new Date(Date.now() + timeOffset * 3600_000);
  const forecastKp = getKpAtTime(kpForecast, kp, targetTime);

  return (
    <div className="relative rounded-lg border border-border overflow-hidden bg-card">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-[500px] md:h-[600px]" />

      {/* View Mode Selector */}
      <div className="absolute top-3 left-12 z-[500] flex gap-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border p-1">
        {viewModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setViewMode(mode.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === mode.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {mode.icon}
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        ))}
      </div>

      {/* Layer Toggles (aggregate mode) */}
      {viewMode === "aggregate" && (
        <div className="absolute top-3 right-3 z-[500] flex gap-2">
          <button
            onClick={() =>
              setLayerToggles((p) => ({ ...p, clouds: !p.clouds }))
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
              layerToggles.clouds
                ? "bg-card/90 border-primary/30 text-primary backdrop-blur-sm"
                : "bg-card/60 border-border text-muted-foreground backdrop-blur-sm"
            }`}
          >
            <Cloud className="h-3 w-3" />
            <span className="hidden sm:inline">Clouds</span>
          </button>
          <button
            onClick={() =>
              setLayerToggles((p) => ({
                ...p,
                lightPollution: !p.lightPollution,
              }))
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
              layerToggles.lightPollution
                ? "bg-card/90 border-primary/30 text-primary backdrop-blur-sm"
                : "bg-card/60 border-border text-muted-foreground backdrop-blur-sm"
            }`}
          >
            <Lightbulb className="h-3 w-3" />
            <span className="hidden sm:inline">Light Poll.</span>
          </button>
        </div>
      )}

      {/* Time Selector */}
      <div className="absolute bottom-32 left-3 right-3 z-[500]">
        <div className="max-w-lg mx-auto rounded-lg bg-card/90 backdrop-blur-sm border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-mono text-muted-foreground">
                {timeOffset === 0
                  ? "Now"
                  : `+${timeOffset}h (Kp ${forecastKp.toFixed(1)})`}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {targetTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={48}
            step={1}
            value={timeOffset}
            onChange={(e) => setTimeOffset(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, hsl(160,80%,50%) ${(timeOffset / 48) * 100}%, hsl(220,15%,18%) ${(timeOffset / 48) * 100}%)`,
            }}
          />
        </div>
      </div>

      {/* Spot Finder */}
      <div className="absolute bottom-3 left-3 z-[500] w-[260px]">
        <div className="rounded-lg bg-card/90 backdrop-blur-sm border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-foreground">Spot Finder</span>
            </div>
            {spotDistance !== null && (
              <span className="text-xs font-mono text-primary font-semibold">
                {spotDistance} km
              </span>
            )}
          </div>
          <div className="flex gap-1 mb-2.5">
            {distancePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() =>
                  setSpotDistance(
                    spotDistance === preset.value ? null : preset.value
                  )
                }
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  spotDistance === preset.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={300}
            step={1}
            value={spotDistance !== null ? Math.round(Math.log10(Math.max(1, spotDistance)) * 100) : 0}
            onChange={(e) => {
              const km = Math.round(10 ** (parseInt(e.target.value) / 100));
              setSpotDistance(Math.max(1, Math.min(1000, km)));
            }}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: spotDistance !== null
                ? `linear-gradient(to right, hsl(160,80%,50%) ${(Math.log10(Math.max(1, spotDistance)) / 3) * 100}%, hsl(220,15%,18%) ${(Math.log10(Math.max(1, spotDistance)) / 3) * 100}%)`
                : "hsl(220,15%,18%)",
            }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">1 km</span>
            <span className="text-[10px] text-muted-foreground">1000 km</span>
          </div>
        </div>
      </div>

      {/* Best Spot Info */}
      {bestSpot && (
        <div className="absolute bottom-3 right-3 z-[500] rounded-lg bg-card/90 backdrop-blur-sm border border-primary/20 p-3 max-w-[200px]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">
              Best Spot
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Aurora: {bestSpot.aurora.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground">
            {bortleLabel(bestSpot.bortle)} (Bortle {bestSpot.bortle})
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {bestSpot.lat.toFixed(2)}, {bestSpot.lon.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
