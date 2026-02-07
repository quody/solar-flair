"use client";

import { useAuroraData } from "@/hooks/useAuroraData";
import { VerdictCard } from "@/components/VerdictCard";
import { KpCard, BzCard, CloudCard } from "@/components/StatCards";
import { KpForecastChart } from "@/components/KpForecastChart";
import { CloudChart } from "@/components/CloudChart";
import { AuroraMap } from "@/components/AuroraMap";
import { RefreshCw, MapPin, Radio, Play, X } from "lucide-react";

export default function Page() {
  const {
    oval,
    kp,
    kpForecast,
    bz,
    cloudCover,
    verdict,
    userLocation,
    loading,
    error,
    lastUpdated,
    demoMode,
    demoDateLabel,
    toggleDemo,
    updateLocation,
  } = useAuroraData();

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Radio className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground tracking-tight">
                  SolarFlair
                </h1>
                <p className="text-[10px] text-muted-foreground leading-none">
                  Aurora Tracker
                </p>
              </div>
            </div>

            {/* Demo Toggle */}
            <button
              onClick={toggleDemo}
              className={`ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                demoMode
                  ? "bg-accent text-accent-foreground border border-accent/50 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                  : "bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80"
              }`}
            >
              {demoMode ? (
                <>
                  <X className="h-3 w-3" />
                  <span>Exit Demo</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  <span>Demo ({demoDateLabel})</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {demoMode && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20">
                <span className="text-[10px] font-mono text-accent">
                  DEMO: {demoDateLabel}
                </span>
              </div>
            )}
            {userLocation && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="font-mono">
                  {userLocation.lat.toFixed(2)}, {userLocation.lon.toFixed(2)}
                </span>
              </div>
            )}
            {lastUpdated && !demoMode && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
                <span className="font-mono">
                  {lastUpdated.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            )}
            {loading && !demoMode && (
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
            )}
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && !demoMode && (
        <div className="max-w-[1600px] mx-auto px-4 pt-3">
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2 text-xs text-destructive">
            {error} - Data may be stale. Retrying...
          </div>
        </div>
      )}

      {/* Map on Top */}
      <div className="max-w-[1600px] mx-auto px-4 pt-4">
        <AuroraMap
          oval={oval}
          kp={kp?.kp ?? 0}
          kpForecast={kpForecast}
          userLocation={userLocation}
          onLocationChange={updateLocation}
        />
      </div>

      {/* Info Boxes Below Map */}
      <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">
        {/* Row 1: Verdict + stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <VerdictCard verdict={verdict} loading={loading} />
          </div>
          <KpCard kp={kp} loading={loading} />
          <BzCard bz={bz} loading={loading} />
          <CloudCard cloudCover={cloudCover} loading={loading} />
        </div>

        {/* Row 2: Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KpForecastChart forecast={kpForecast} loading={loading} />
          <CloudChart cloudCover={cloudCover} loading={loading} />
        </div>

        {/* Data Source Info */}
        <div className="mt-4 rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {demoMode
              ? `Demo mode: Showing simulated G2 geomagnetic storm data for ${demoDateLabel}. Toggle off to return to live data.`
              : "Data: NOAA OVATION Aurora Model, NOAA Kp Index, NOAA Solar Wind Bz, Open-Meteo Cloud Cover, David Lorenz Light Pollution Atlas 2024, Sunrise-Sunset.org. Refreshes every 60 seconds."}
          </p>
        </div>
      </div>
    </main>
  );
}
