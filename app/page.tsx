"use client";

import { useAuroraData } from "@/hooks/useAuroraData";
import { VerdictCard } from "@/components/VerdictCard";
import { KpCard, BzCard, CloudCard } from "@/components/StatCards";
import { KpForecastChart } from "@/components/KpForecastChart";
import { CloudChart } from "@/components/CloudChart";
import { AuroraMap } from "@/components/AuroraMap";
import { Header } from "@/components/Header";

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
      <Header
        loading={loading}
        demoMode={demoMode}
        demoDateLabel={demoDateLabel}
        lastUpdated={lastUpdated}
        userLocation={userLocation}
        toggleDemo={toggleDemo}
      />

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
