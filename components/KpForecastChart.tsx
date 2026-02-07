"use client";

import type { KpForecastEntry } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface KpForecastChartProps {
  forecast: KpForecastEntry[];
  loading?: boolean;
}

export function KpForecastChart({ forecast, loading }: KpForecastChartProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 animate-pulse">
        <div className="h-3 w-28 rounded bg-muted mb-4" />
        <div className="h-[160px] rounded bg-muted" />
      </div>
    );
  }

  const data = forecast.slice(0, 24).map((entry) => {
    const d = new Date(entry.time);
    return {
      time: d.toLocaleDateString([], { weekday: "short" }) +
        " " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      shortTime:
        d.toLocaleTimeString([], { hour: "2-digit", hour12: false }),
      kp: entry.kp,
    };
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Kp Forecast (3 days)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="kpGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(160, 80%, 50%)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(160, 80%, 50%)" stopOpacity={0} />
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
            domain={[0, 9]}
            tick={{ fill: "hsl(210, 10%, 55%)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            ticks={[0, 3, 5, 7, 9]}
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
            formatter={(value: number) => [value.toFixed(1), "Kp"]}
            labelFormatter={(label: string, payload) => {
              if (payload && payload[0]) {
                const item = data.find((d) => d.shortTime === label);
                return item?.time ?? label;
              }
              return label;
            }}
          />
          <ReferenceLine
            y={5}
            stroke="hsl(0, 72%, 55%)"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
            label={{
              value: "Storm",
              position: "right",
              fill: "hsl(0, 72%, 55%)",
              fontSize: 10,
              opacity: 0.6,
            }}
          />
          <ReferenceLine
            y={4}
            stroke="hsl(45, 80%, 55%)"
            strokeDasharray="4 4"
            strokeOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="kp"
            stroke="hsl(160, 80%, 50%)"
            strokeWidth={2}
            fill="url(#kpGradient)"
            dot={false}
            activeDot={{
              r: 4,
              fill: "hsl(160, 80%, 50%)",
              stroke: "hsl(220, 18%, 10%)",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
