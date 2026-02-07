"use client";

import type { KpEntry, BzData, CloudHourly } from "@/lib/api";
import { Activity, ArrowDown, Cloud } from "lucide-react";

export interface StatCardsProps {
  kp: KpEntry | null;
  bz: BzData | null;
  cloudCover: CloudHourly | null;
  loading?: boolean;
}

function getKpColor(kp: number): string {
  if (kp >= 7) return "text-red-400";
  if (kp >= 5) return "text-orange-400";
  if (kp >= 4) return "text-amber-400";
  if (kp >= 3) return "text-emerald-400";
  return "text-muted-foreground";
}

function getBzColor(bz: number): string {
  if (bz < -10) return "text-emerald-400";
  if (bz < -5) return "text-emerald-400/80";
  if (bz < 0) return "text-amber-400";
  return "text-muted-foreground";
}

function getCloudColor(cloud: number): string {
  if (cloud < 20) return "text-emerald-400";
  if (cloud < 50) return "text-amber-400";
  return "text-orange-400";
}

function StatSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 animate-pulse">
      <div className="h-3 w-16 rounded bg-muted mb-3" />
      <div className="h-8 w-20 rounded bg-muted mb-1" />
      <div className="h-3 w-24 rounded bg-muted" />
    </div>
  );
}

export function KpCard({ kp, loading }: { kp: KpEntry | null; loading?: boolean }) {
  if (loading) return <StatSkeleton />;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Kp Index
        </span>
      </div>
      <p
        className={`text-2xl font-mono font-bold tabular-nums ${kp ? getKpColor(kp.kp) : "text-muted-foreground"}`}
      >
        {kp ? kp.kp.toFixed(1) : "--"}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {kp
          ? kp.kp >= 5
            ? "Storm level"
            : kp.kp >= 4
              ? "Active"
              : kp.kp >= 3
                ? "Moderate"
                : "Quiet"
          : "Loading..."}
      </p>
    </div>
  );
}

export function BzCard({ bz, loading }: { bz: BzData | null; loading?: boolean }) {
  if (loading) return <StatSkeleton />;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Bz
        </span>
      </div>
      <p
        className={`text-2xl font-mono font-bold tabular-nums ${bz ? getBzColor(bz.bz) : "text-muted-foreground"}`}
      >
        {bz ? `${bz.bz.toFixed(1)}` : "--"}
        {bz && (
          <span className="text-sm font-normal text-muted-foreground ml-1">
            nT
          </span>
        )}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {bz
          ? bz.bz < -5
            ? "Southward (good)"
            : bz.bz < 0
              ? "Slightly south"
              : "Northward"
          : "Loading..."}
      </p>
    </div>
  );
}

export function CloudCard({ cloudCover, loading }: { cloudCover: CloudHourly | null; loading?: boolean }) {
  if (loading) return <StatSkeleton />;
  const currentCloud = cloudCover?.values[0] ?? null;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Clouds
        </span>
      </div>
      <p
        className={`text-2xl font-mono font-bold tabular-nums ${currentCloud !== null ? getCloudColor(currentCloud) : "text-muted-foreground"}`}
      >
        {currentCloud !== null ? `${Math.round(currentCloud)}%` : "--"}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {currentCloud !== null
          ? currentCloud < 20
            ? "Clear skies"
            : currentCloud < 50
              ? "Partly cloudy"
              : "Overcast"
          : "Loading..."}
      </p>
    </div>
  );
}

export function StatCards({ kp, bz, cloudCover, loading }: StatCardsProps) {
  return (
    <div className="flex flex-col gap-3">
      <KpCard kp={kp} loading={loading} />
      <BzCard bz={bz} loading={loading} />
      <CloudCard cloudCover={cloudCover} loading={loading} />
    </div>
  );
}
