"use client";

import NumberFlow from "@number-flow/react";
import { useExtracted } from "next-intl";
import { useMemo, useState } from "react";
import { FunnelResponse } from "../../../../api/analytics/endpoints";
import { cn } from "../../../../lib/utils";

type FunnelGradientChartProps = {
  data: FunnelResponse[];
  className?: string;
};

type SegmentGeometry = {
  step: FunnelResponse;
  index: number;
  x: number;
  width: number;
  topStart: number;
  topEnd: number;
  bottomStart: number;
  bottomEnd: number;
  dropoffFromPrev: number;
  stepConversion: number;
};

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 160;
const CENTER_Y = CHART_HEIGHT / 2;
const MAX_HALF_HEIGHT = 62;
const CORNER_RADIUS = 14;

function buildSegments(data: FunnelResponse[]): SegmentGeometry[] {
  const maxVisitors = data[0]?.visitors || 1;
  const stepCount = data.length;
  const segmentWidth = CHART_WIDTH / stepCount;

  return data.map((step, index) => {
    const ratio = step.visitors / maxVisitors;
    const nextRatio =
      index < data.length - 1 ? data[index + 1].visitors / maxVisitors : Math.max(ratio * 0.35, 0.08);

    const topStart = CENTER_Y - ratio * MAX_HALF_HEIGHT;
    const bottomStart = CENTER_Y + ratio * MAX_HALF_HEIGHT;
    const topEnd = CENTER_Y - nextRatio * MAX_HALF_HEIGHT;
    const bottomEnd = CENTER_Y + nextRatio * MAX_HALF_HEIGHT;

    const prev = index > 0 ? data[index - 1] : null;
    const dropoffFromPrev =
      prev && prev.visitors > 0 ? ((prev.visitors - step.visitors) / prev.visitors) * 100 : 0;
    const stepConversion = prev && prev.visitors > 0 ? (step.visitors / prev.visitors) * 100 : 100;

    return {
      step,
      index,
      x: index * segmentWidth,
      width: segmentWidth,
      topStart,
      topEnd,
      bottomStart,
      bottomEnd,
      dropoffFromPrev,
      stepConversion,
    };
  });
}

function buildFunnelPath(segments: SegmentGeometry[]): string {
  if (segments.length === 0) return "";

  const topPoints = segments.flatMap((seg, i) => {
    const x0 = seg.x;
    const x1 = seg.x + seg.width;
    if (i === 0) {
      return [`M ${x0 + CORNER_RADIUS} ${seg.topStart}`, `Q ${x0} ${seg.topStart} ${x0} ${seg.topStart + CORNER_RADIUS}`];
    }
    return [`L ${x0} ${seg.topStart}`, `L ${x1} ${seg.topEnd}`];
  });

  const last = segments[segments.length - 1];
  const endX = last.x + last.width;

  const bottomPoints = [...segments]
    .reverse()
    .flatMap((seg, reverseIndex) => {
      const i = segments.length - 1 - reverseIndex;
      const x0 = seg.x;
      const x1 = seg.x + seg.width;
      if (reverseIndex === 0) {
        return [`L ${endX} ${seg.bottomEnd}`, `L ${x0} ${seg.bottomStart}`];
      }
      return [`L ${x1} ${segments[i + 1].bottomEnd}`, `L ${x0} ${seg.bottomStart}`];
    });

  const first = segments[0];
  return [
    ...topPoints,
    `L ${endX} ${last.topEnd}`,
    `L ${endX} ${last.bottomEnd}`,
    ...bottomPoints,
    `L ${first.x} ${first.bottomStart}`,
    `Q ${first.x} ${first.bottomStart} ${first.x + CORNER_RADIUS} ${first.bottomStart}`,
    "Z",
  ].join(" ");
}

export function FunnelGradientChart({ data, className }: FunnelGradientChartProps) {
  const t = useExtracted();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const segments = useMemo(() => buildSegments(data), [data]);
  const funnelPath = useMemo(() => buildFunnelPath(segments), [segments]);

  if (!data.length) return null;

  const lastStep = data[data.length - 1];
  const totalConversion = lastStep?.conversion_rate ?? 0;
  const hovered = hoveredIndex !== null ? segments[hoveredIndex] : null;

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-start justify-between mb-5">
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

      <div className="relative">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full h-[140px]"
          preserveAspectRatio="none"
          role="img"
          aria-label={t("Funnel chart")}
        >
          <defs>
            <linearGradient id="funnelBody" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--accent-400))" stopOpacity="0.95" />
              <stop offset="55%" stopColor="hsl(var(--accent-400))" stopOpacity="0.55" />
              <stop offset="100%" stopColor="hsl(var(--accent-400))" stopOpacity="0.12" />
            </linearGradient>
            <filter id="funnelSoftGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            d={funnelPath}
            fill="url(#funnelBody)"
            stroke="hsl(var(--accent-400))"
            strokeOpacity="0.25"
            strokeWidth="1"
            filter="url(#funnelSoftGlow)"
          />

          {segments.map((seg, index) => (
            <rect
              key={seg.step.step_number}
              x={seg.x}
              y={0}
              width={seg.width}
              height={CHART_HEIGHT}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}

          {hovered && (
            <path
              d={(() => {
                const seg = hovered;
                const x0 = seg.x;
                const x1 = seg.x + seg.width;
                return [
                  `M ${x0} ${seg.topStart}`,
                  `L ${x1} ${seg.topEnd}`,
                  `L ${x1} ${seg.bottomEnd}`,
                  `L ${x0} ${seg.bottomStart}`,
                  "Z",
                ].join(" ");
              })()}
              fill="hsl(var(--accent-400))"
              fillOpacity="0.22"
              stroke="hsl(var(--accent-400))"
              strokeOpacity="0.5"
              strokeWidth="1.5"
              pointerEvents="none"
            />
          )}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute z-10 min-w-[180px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg px-3 py-2.5 text-xs"
            style={{
              left: `${((hovered.x + hovered.width / 2) / CHART_WIDTH) * 100}%`,
              top: "8px",
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-semibold text-sm mb-1.5 truncate">{hovered.step.step_name}</div>
            <div className="flex justify-between gap-4 tabular-nums">
              <span className="text-muted-foreground">{t("Visitors")}</span>
              <span className="font-medium">{hovered.step.visitors.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4 tabular-nums mt-1">
              <span className="text-muted-foreground">{t("Of total")}</span>
              <span className="font-medium">{hovered.step.conversion_rate.toFixed(1)}%</span>
            </div>
            {hovered.index > 0 && (
              <>
                <div className="flex justify-between gap-4 tabular-nums mt-1">
                  <span className="text-muted-foreground">{t("From previous")}</span>
                  <span className="font-medium">{hovered.stepConversion.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between gap-4 tabular-nums mt-1">
                  <span className="text-muted-foreground">{t("Dropped")}</span>
                  <span className="font-medium text-red-400">-{hovered.dropoffFromPrev.toFixed(1)}%</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div
        className="grid gap-1 mt-4"
        style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
      >
        {segments.map(seg => (
          <div
            key={seg.step.step_number}
            className={cn(
              "min-w-0 text-center px-1 py-1 rounded-md transition-colors",
              hoveredIndex === seg.index && "bg-neutral-100 dark:bg-neutral-800/60"
            )}
            onMouseEnter={() => setHoveredIndex(seg.index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {seg.index > 0 && seg.dropoffFromPrev > 0 && (
              <div className="text-[10px] font-medium text-red-400 mb-0.5 tabular-nums">
                -{seg.dropoffFromPrev.toFixed(1)}%
              </div>
            )}
            <div className="text-base font-semibold tabular-nums">{seg.step.visitors.toLocaleString()}</div>
            <div
              className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate"
              title={seg.step.step_name}
            >
              {seg.step.step_name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}