"use client";

import NumberFlow from "@number-flow/react";
import { useExtracted } from "next-intl";
import { useId, useMemo, useState } from "react";
import { FunnelResponse } from "../../../../api/analytics/endpoints";
import { cn } from "../../../../lib/utils";

type FunnelGradientChartProps = {
  data: FunnelResponse[];
  className?: string;
};

type StagePoint = {
  step: FunnelResponse;
  index: number;
  centerX: number;
  segmentStart: number;
  segmentEnd: number;
  halfHeight: number;
  dropoffFromPrev: number;
  stepConversion: number;
};

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 156;
const CENTER_Y = 82;
const MAX_HALF_HEIGHT = 56;
/** Minimum visible band for zero/near-zero steps (~12px total thickness). */
const MIN_HALF_HEIGHT = 6;
/** Hold each stage's width across this fraction of its column before tapering. */
const PLATEAU_FRACTION = 0.58;

function halfHeightFor(visitors: number, maxVisitors: number) {
  const ratio = visitors / maxVisitors;
  return Math.max(ratio * MAX_HALF_HEIGHT, MIN_HALF_HEIGHT);
}

function computeStagePoints(data: FunnelResponse[]): StagePoint[] {
  const count = data.length;
  const maxVisitors = Math.max(data[0]?.visitors ?? 0, 1);
  const segmentWidth = CHART_WIDTH / count;

  return data.map((step, index) => {
    const segmentStart = index * segmentWidth;
    const segmentEnd = (index + 1) * segmentWidth;
    const prev = index > 0 ? data[index - 1] : null;
    const dropoffFromPrev =
      prev && prev.visitors > 0 ? ((prev.visitors - step.visitors) / prev.visitors) * 100 : 0;
    const stepConversion = prev && prev.visitors > 0 ? (step.visitors / prev.visitors) * 100 : 100;

    return {
      step,
      index,
      centerX: segmentStart + segmentWidth / 2,
      segmentStart,
      segmentEnd,
      halfHeight: halfHeightFor(step.visitors, maxVisitors),
      dropoffFromPrev,
      stepConversion,
    };
  });
}

/**
 * Each stage column: flat plateau at that stage's width, then a cubic taper into the next.
 * One closed path — top left→right, bottom right→left.
 */
function buildBezierFunnelPath(points: StagePoint[]): string {
  const n = points.length;
  if (n === 0) return "";

  const yTop = (i: number) => CENTER_Y - points[i].halfHeight;
  const yBot = (i: number) => CENTER_Y + points[i].halfHeight;
  const segmentWidth = CHART_WIDTH / n;

  if (n === 1) {
    return `M 0 ${yTop(0)} L ${CHART_WIDTH} ${yTop(0)} L ${CHART_WIDTH} ${yBot(0)} L 0 ${yBot(0)} Z`;
  }

  const top: string[] = [`M 0 ${yTop(0)}`];

  for (let i = 0; i < n; i++) {
    const xStart = i * segmentWidth;
    const xEnd = (i + 1) * segmentWidth;
    const xPlateauEnd = xStart + segmentWidth * PLATEAU_FRACTION;

    top.push(`L ${xPlateauEnd} ${yTop(i)}`);

    if (i < n - 1) {
      const xMid = (xPlateauEnd + xEnd) / 2;
      top.push(`C ${xMid} ${yTop(i)} ${xMid} ${yTop(i + 1)} ${xEnd} ${yTop(i + 1)}`);
    } else {
      top.push(`L ${CHART_WIDTH} ${yTop(i)}`);
    }
  }

  const bottom: string[] = [`L ${CHART_WIDTH} ${yBot(n - 1)}`];

  for (let i = n - 1; i >= 0; i--) {
    const xStart = i * segmentWidth;
    const xEnd = (i + 1) * segmentWidth;
    const xPlateauEnd = xStart + segmentWidth * PLATEAU_FRACTION;

    bottom.push(`L ${xPlateauEnd} ${yBot(i)}`);

    if (i > 0) {
      const xMid = (xPlateauEnd + xStart) / 2;
      bottom.push(`C ${xMid} ${yBot(i)} ${xMid} ${yBot(i - 1)} ${xStart} ${yBot(i - 1)}`);
    }
  }

  bottom.push(`L 0 ${yBot(0)}`, "Z");

  return [...top, ...bottom].join(" ");
}

function segmentHighlightPath(seg: StagePoint): string {
  const yTop = CENTER_Y - seg.halfHeight;
  const yBot = CENTER_Y + seg.halfHeight;
  return `M ${seg.segmentStart} ${yTop} L ${seg.segmentEnd} ${yTop} L ${seg.segmentEnd} ${yBot} L ${seg.segmentStart} ${yBot} Z`;
}

function tooltipPosition(seg: StagePoint, total: number) {
  const centerPct = (seg.centerX / CHART_WIDTH) * 100;

  if (seg.index === 0) {
    return { left: `${Math.max(centerPct, 8)}%`, transform: "translateX(0)" };
  }
  if (seg.index === total - 1) {
    return { left: `${Math.min(centerPct, 92)}%`, transform: "translateX(-100%)" };
  }
  return { left: `${centerPct}%`, transform: "translateX(-50%)" };
}

export function FunnelGradientChart({ data, className }: FunnelGradientChartProps) {
  const t = useExtracted();
  const gradientId = useId();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const points = useMemo(() => computeStagePoints(data), [data]);
  const funnelPath = useMemo(() => buildBezierFunnelPath(points), [points]);

  if (!data.length) return null;

  const lastStep = data[data.length - 1];
  const totalConversion = lastStep?.conversion_rate ?? 0;
  const hovered = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className={cn("relative overflow-visible", className)}>
      <div className="flex items-start justify-between mb-4">
        <div />
        <div className="text-right shrink-0">
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

      <div className="relative pt-7 overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-6 pointer-events-none">
          {points.map(
            seg =>
              seg.index > 0 &&
              seg.dropoffFromPrev > 0 && (
                <div
                  key={`drop-${seg.step.step_number}`}
                  className={cn(
                    "absolute -translate-x-1/2 text-[10px] font-medium tabular-nums text-red-400/90 transition-opacity",
                    hoveredIndex !== null && hoveredIndex !== seg.index && "opacity-35"
                  )}
                  style={{ left: `${(seg.centerX / CHART_WIDTH) * 100}%` }}
                >
                  -{seg.dropoffFromPrev.toFixed(1)}%
                </div>
              )
          )}
        </div>

        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full h-[140px] overflow-visible"
          preserveAspectRatio="none"
          role="img"
          aria-label={t("Funnel chart")}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--accent-400))" stopOpacity="0.9" />
              <stop offset="45%" stopColor="hsl(var(--accent-400))" stopOpacity="0.55" />
              <stop offset="100%" stopColor="hsl(var(--accent-400))" stopOpacity="0.16" />
            </linearGradient>
          </defs>

          <path
            d={funnelPath}
            fill={`url(#${gradientId})`}
            stroke="hsl(var(--accent-400))"
            strokeOpacity="0.22"
            strokeWidth="1"
          />

          {hovered && (
            <path
              d={segmentHighlightPath(hovered)}
              fill="hsl(var(--accent-400))"
              fillOpacity="0.2"
              stroke="hsl(var(--accent-400))"
              strokeOpacity="0.45"
              strokeWidth="1.5"
              pointerEvents="none"
            />
          )}

          {points.map(seg => (
            <rect
              key={seg.step.step_number}
              x={seg.segmentStart}
              y={0}
              width={seg.segmentEnd - seg.segmentStart}
              height={CHART_HEIGHT}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(seg.index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute z-20 min-w-[176px] max-w-[220px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg px-3 py-2.5 text-xs"
            style={{ top: "32px", ...tooltipPosition(hovered, points.length) }}
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
        className="grid gap-1 mt-3"
        style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
      >
        {points.map(seg => (
          <div
            key={seg.step.step_number}
            className={cn(
              "min-w-0 text-center px-1 py-1 rounded-md transition-colors cursor-default",
              hoveredIndex === seg.index && "bg-neutral-100 dark:bg-neutral-800/60"
            )}
            onMouseEnter={() => setHoveredIndex(seg.index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
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