"use client";

import React from "react"

import type { Verdict } from "@/lib/api";
import { Eye, EyeOff, Sun, Zap, Activity, AlertTriangle } from "lucide-react";

const levelConfig: Record<
  string,
  { bg: string; border: string; icon: React.ReactNode; glow: string }
> = {
  excellent: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: <Zap className="h-5 w-5 text-emerald-400" />,
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
  },
  good: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/20",
    icon: <Eye className="h-5 w-5 text-emerald-400" />,
    glow: "shadow-[0_0_12px_rgba(16,185,129,0.1)]",
  },
  moderate: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    icon: <Activity className="h-5 w-5 text-amber-400" />,
    glow: "",
  },
  poor: {
    bg: "bg-muted/50",
    border: "border-border",
    icon: <EyeOff className="h-5 w-5 text-muted-foreground" />,
    glow: "",
  },
  none: {
    bg: "bg-orange-500/5",
    border: "border-orange-500/20",
    icon: <Sun className="h-5 w-5 text-orange-400" />,
    glow: "",
  },
};

interface VerdictCardProps {
  verdict: Verdict | null;
  loading?: boolean;
}

export function VerdictCard({ verdict, loading }: VerdictCardProps) {
  if (loading || !verdict) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 animate-pulse">
        <div className="h-4 w-24 rounded bg-muted mb-3" />
        <div className="h-6 w-32 rounded bg-muted mb-2" />
        <div className="h-3 w-full rounded bg-muted" />
      </div>
    );
  }

  const config = levelConfig[verdict.level] ?? levelConfig.poor;

  return (
    <div
      className={`rounded-lg border ${config.border} ${config.bg} ${config.glow} p-4 transition-all`}
    >
      <div className="flex items-center gap-2 mb-2">
        {config.icon}
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Aurora Verdict
        </span>
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-1">
        {verdict.label}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {verdict.description}
      </p>
      {verdict.darkUntil && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          <span>Dark until {verdict.darkUntil}</span>
        </div>
      )}
    </div>
  );
}
