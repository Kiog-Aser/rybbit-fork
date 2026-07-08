"use client";

import NumberFlow from "@number-flow/react";
import { useExtracted } from "next-intl";
import { FunnelResponse } from "../../../../api/analytics/endpoints";

type FunnelGradientChartProps = {
  data: FunnelResponse[];
  className?: string;
};

export function FunnelGradientChart({ data, className }: FunnelGradientChartProps) {
  const t = useExtracted();

  if (!data.length) return null;

  const firstStep = data[0];
  const lastStep = data[data.length - 1];
  const totalConversion = lastStep?.conversion_rate ?? 0;

  const maxVisitors = firstStep.visitors || 1;
  const stepCount = data.length;

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <div />
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">
            <NumberFlow
              respectMotionPreference={false}
              value={Number(totalConversion.toFixed(1))}
              suffix="%"
              format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
            />
          </div>
          <div className="text-xs text-muted-foreground">{t("conversion rate")}</div>
        </div>
      </div>

      <div className="relative h-28 mb-2">
        <svg viewBox="0 0 1000 120" className="w-full h-full" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="funnelFill" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--accent-400))" stopOpacity="0.9" />
              <stop offset="55%" stopColor="hsl(var(--accent-400))" stopOpacity="0.45" />
              <stop offset="100%" stopColor="hsl(var(--accent-400))" stopOpacity="0.08" />
            </linearGradient>
          </defs>
          {data.map((step, index) => {
            const ratio = step.visitors / maxVisitors;
            const nextRatio = index < data.length - 1 ? data[index + 1].visitors / maxVisitors : ratio * 0.15;
            const xStart = (index / stepCount) * 1000;
            const xEnd = ((index + 1) / stepCount) * 1000;
            const yTopStart = 60 - ratio * 50;
            const yBottomStart = 60 + ratio * 50;
            const yTopEnd = 60 - nextRatio * 50;
            const yBottomEnd = 60 + nextRatio * 50;
            const points = `${xStart},${yTopStart} ${xEnd},${yTopEnd} ${xEnd},${yBottomEnd} ${xStart},${yBottomStart}`;
            return <polygon key={step.step_number} points={points} fill="url(#funnelFill)" opacity={0.55 + index * 0.08} />;
          })}
        </svg>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${stepCount}, minmax(0, 1fr))` }}
      >
        {data.map((step, index) => {
          const prev = index > 0 ? data[index - 1] : null;
          const dropoff =
            prev && prev.visitors > 0 ? ((prev.visitors - step.visitors) / prev.visitors) * 100 : 0;

          return (
            <div key={step.step_number} className="min-w-0 text-center px-1">
              {index > 0 && dropoff > 0 && (
                <div className="text-[10px] font-medium text-red-400 mb-1 tabular-nums">
                  -{dropoff.toFixed(1)}%
                </div>
              )}
              <div className="text-lg font-semibold tabular-nums">{step.visitors.toLocaleString()}</div>
              <div className="text-[11px] text-muted-foreground leading-tight mt-1 truncate" title={step.step_name}>
                {step.step_name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}