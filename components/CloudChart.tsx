"use client";

import type { CloudHourly } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CloudChartProps {
  cloudCover: CloudHourly | null;
  loading?: boolean;
}

export function CloudChart({ cloudCover, loading }: CloudChartProps) {
  if (loading || !cloudCover) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 animate-pulse">
        <div className="h-3 w-32 rounded bg-muted mb-4" />
        <div className="h-[160px] rounded bg-muted" />
      </div>
    );
  }

  const data = cloudCover.hours.map((hour, i) => {
    const d = new Date(hour);
    return {
      time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      shortTime: d.toLocaleTimeString([], { hour: "2-digit", hour12: false }),
      cloud: cloudCover.values[i],
      clear: 100 - cloudCover.values[i],
    };
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Cloud Cover (48h)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="cloudGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(210, 10%, 55%)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(210, 10%, 55%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="shortTime"
            tick={{ fill: "hsl(210, 10%, 55%)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "hsl(210, 10%, 55%)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(220, 18%, 10%)",
              border: "1px solid hsl(220, 15%, 18%)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "hsl(210, 20%, 92%)",
            }}
            labelStyle={{ color: "hsl(210, 10%, 55%)" }}
            formatter={(value: number) => [`${Math.round(value)}%`, "Cloud Cover"]}
            labelFormatter={(label: string, payload) => {
              if (payload && payload[0]) {
                const item = data.find((d) => d.shortTime === label);
                return item?.time ?? label;
              }
              return label;
            }}
          />
          <Area
            type="monotone"
            dataKey="cloud"
            stroke="hsl(210, 10%, 55%)"
            strokeWidth={1.5}
            fill="url(#cloudGradient)"
            dot={false}
            activeDot={{
              r: 4,
              fill: "hsl(210, 10%, 55%)",
              stroke: "hsl(220, 18%, 10%)",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
