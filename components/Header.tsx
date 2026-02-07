"use client";

import { RefreshCw, MapPin, Play, X, Sparkles } from "lucide-react";

interface HeaderProps {
  loading: boolean;
  demoMode: boolean;
  demoDateLabel: string;
  lastUpdated: Date | null;
  userLocation: { lat: number; lon: number } | null;
  toggleDemo: () => void;
}

function AuroraLogo() {
  return (
    <div className="relative h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden group-hover:bg-primary/15 transition-colors">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,hsl(160_80%_50%/0.3),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,hsl(280_70%_60%/0.15),transparent_60%)]" />
      <Sparkles className="h-4 w-4 text-primary relative z-10" />
    </div>
  );
}

function LiveIndicator({ lastUpdated }: { lastUpdated: Date }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
      <div className="relative flex items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
        <div className="absolute h-2 w-2 rounded-full bg-primary/40 animate-ping" />
      </div>
      <span className="text-xs font-mono text-primary/80 tabular-nums">
        {lastUpdated.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
    </div>
  );
}

function LocationBadge({ lat, lon }: { lat: number; lon: number }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-secondary/60 border border-border/60">
      <MapPin className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs font-mono text-muted-foreground tabular-nums">
        {lat.toFixed(2)}, {lon.toFixed(2)}
      </span>
    </div>
  );
}

function DemoBadge({ demoDateLabel }: { demoDateLabel: string }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-accent/10 border border-accent/20">
      <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
      <span className="text-[11px] font-mono text-accent tracking-wide">
        DEMO: {demoDateLabel}
      </span>
    </div>
  );
}

export function Header({
  loading,
  demoMode,
  demoDateLabel,
  lastUpdated,
  userLocation,
  toggleDemo,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 header-glow">
      <div className="border-b border-border/60 bg-card/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: Brand + Demo Toggle */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 group cursor-default">
              <AuroraLogo />
              <div>
                <h1 className="text-base font-semibold text-foreground tracking-tight leading-tight">
                  SolarFlair
                </h1>
                <p className="text-[11px] text-muted-foreground leading-none mt-0.5 tracking-wide">
                  Aurora Tracker
                </p>
              </div>
            </div>

            <div className="h-6 w-px bg-border/60 hidden sm:block" />

            {/* Demo Toggle */}
            <button
              onClick={toggleDemo}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                demoMode
                  ? "bg-accent/15 text-accent-foreground border border-accent/30 shadow-[0_0_16px_-4px_hsl(280_70%_60%/0.3)] hover:bg-accent/20"
                  : "bg-secondary/60 text-secondary-foreground border border-border/60 hover:bg-secondary hover:border-border"
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
                  <span className="hidden sm:inline">Demo</span>
                  <span className="text-muted-foreground hidden sm:inline">
                    ({demoDateLabel})
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Right: Status indicators */}
          <div className="flex items-center gap-2">
            {demoMode && <DemoBadge demoDateLabel={demoDateLabel} />}
            {userLocation && (
              <LocationBadge lat={userLocation.lat} lon={userLocation.lon} />
            )}
            {lastUpdated && !demoMode && (
              <LiveIndicator lastUpdated={lastUpdated} />
            )}
            {loading && !demoMode && (
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-secondary/40">
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
