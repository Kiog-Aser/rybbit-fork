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

type StagePoint = {
  step: FunnelResponse;
  index: number;
  x: number;
  halfHeight: number;
  dropoffFromPrev: number;
  stepConversion: number;
  hoverStart: number;
  hoverEnd: number;
};

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 148;
const LEFT_CAP = 10;
const CENTER_Y = 78;
const MAX_HALF_HEIGHT = 54;
/** Keeps zero-value stages visible as a thin persisting band. */
const MIN_HALF_HEIGHT = 3.5;

function computeStagePoints(data: FunnelResponse[]): StagePoint[] {
  const count = data.length;
  const maxVisitors = Math.max(data[0]?.visitors ?? 0, 1);
  const span = CHART_WIDTH - LEFT_CAP;

  const points = data.map((step, index) => {
    const ratio = step.visitors / maxVisitors;
    const halfHeight = Math.max(ratio * MAX_HALF_HEIGHT, MIN_HALF_HEIGHT);
    const x = count <= 1 ? CHART_WIDTH / 2 : LEFT_CAP + (index / (count - 1)) * span;

    const prev = index > 0 ? data[index - 1] : null;
    const dropoffFromPrev =
      prev && prev.visitors > 0 ? ((prev.visitors - step.visitors) / prev.visitors) * 100 : 0;
    const stepConversion = prev && prev.visitors > 0 ? (step.visitors / prev.visitors) * 100 : 100;

    return {
      step,
      index,
      x,
      halfHeight,
      dropoffFromPrev,
      stepConversion,
      hoverStart: 0,
      hoverEnd: 0,
    };
  });

  for (let i = 0; i < points.length; i++) {
    const prevX = i > 0 ? points[i - 1].x : 0;
    const nextX = i < points.length - 1 ? points[i + 1].x : CHART_WIDTH;
    points[i].hoverStart = i === 0 ? 0 : (prevX + points[i].x) / 2;
    points[i].hoverEnd = i === points.length - 1 ? CHART_WIDTH : (points[i].x + nextX) / 2;
  }

  return points;
}

/** One closed path: left cap → top Bézier chain → right tail → bottom Bézier chain → Z */
function buildBezierFunnelPath(points: StagePoint[]): string {
  if (points.length === 0) return "";

  if (points.length === 1) {
    const p = points[0];
    const yTop = CENTER_Y - p.halfHeight;
    const yBot = CENTER_Y + p.halfHeight;
    return `M 0 ${yTop} L ${CHART_WIDTH} ${yTop} L ${CHART_WIDTH} ${yBot} L 0 ${yBot} Z`;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const yTop0 = CENTER_Y - first.halfHeight;
  const yBot0 = CENTER_Y + first.halfHeight;
  const yTopN = CENTER_Y - last.halfHeight;
  const yBotN = CENTER_Y + last.halfHeight;

  const parts: string[] = [
    `M 0 ${yTop0}`,
    `L ${first.x} ${yTop0}`,
  ];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const xMid = (p1.x + p2.x) / 2;
    const y1 = CENTER_Y - p1.halfHeight;
    const y2 = CENTER_Y - p2.halfHeight;
    parts.push(`C ${xMid} ${y1} ${xMid} ${y2} ${p2.x} ${y2}`);
  }

  parts.push(`L ${CHART_WIDTH} ${yTopN}`);
  parts.push(`L ${CHART_WIDTH} ${yBotN}`);
  parts.push(`L ${last.x} ${yBotN}`);

  for (let i = points.length - 1; i > 0; i--) {
    const p1 = points[i];
    const p2 = points[i - 1];
    const xMid = (p2.x + p1.x) / 2;
    const y1 = CENTER_Y + p1.halfHeight;
    const y2 = CENTER_Y + p2.halfHeight;
    parts.push(`C ${xMid} ${y1} ${xMid} ${y2} ${p2.x} ${y2}`);
  }

  parts.push(`L 0 ${yBot0}`);
  parts.push("Z");

  return parts.join(" ");
}

function segmentHighlightPath(seg: StagePoint, next: StagePoint | undefined): string {
  const x0 = seg.hoverStart;
  const x1 = seg.hoverEnd;
  const yTop0 = CENTER_Y - seg.halfHeight;
  const yBot0 = CENTER_Y + seg.halfHeight;

  if (!next) {
    const yTop1 = yTop0;
    const yBot1 = yBot0;
    return `M ${x0} ${yTop0} L ${x1} ${yTop1} L ${x1} ${yBot1} L ${x0} ${yBot0} Z`;
  }

  const xMid = (seg.x + next.x) / 2;
  const yTop1 = CENTER_Y - next.halfHeight;
  const yBot1 = CENTER_Y + next.halfHeight;

  return [
    `M ${x0} ${yTop0}`,
    `C ${xMid} ${yTop0} ${xMid} ${yTop1} ${x1} ${yTop1}`,
    `L ${x1} ${yBot1}`,
    `C ${xMid} ${yBot1} ${xMid} ${yBot0} ${x0} ${yBot0}`,
    "Z",
  ].join(" ");
}

export function FunnelGradientChart({ data, className }: FunnelGradientChartProps) {
  const t = useExtracted();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const points = useMemo(() => computeStagePoints(data), [data]);
  const funnelPath = useMemo(() => buildBezierFunnelPath(points), [points]);

  if (!data.length) return null;

  const lastStep = data[data.length - 1];
  const totalConversion = lastStep?.conversion_rate ?? 0;
  const hovered = hoveredIndex !== null ? points[hoveredIndex] : null;
  const hoveredNext = hoveredIndex !== null && hoveredIndex < points.length - 1 ? points[hoveredIndex + 1] : undefined;

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-start justify-between mb-4">
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

      <div className="relative pt-7">
        {/* Drop labels sit above the funnel in clear space */}
        <div className="absolute top-0 left-0 right-0 h-6 pointer-events-none">
          {points.map(
            seg =>
              seg.index > 0 &&
              seg.dropoffFromPrev > 0 && (
                <div
                  key={`drop-${seg.step.step_number}`}
                  className={cn(
                    "absolute -translate-x-1/2 text-[10px] font-medium tabular-nums text-red-400 transition-opacity",
                    hoveredIndex !== null && hoveredIndex !== seg.index && "opacity-40"
                  )}
                  style={{ left: `${(seg.x / CHART_WIDTH) * 100}%` }}
                >
                  -{seg.dropoffFromPrev.toFixed(1)}%
                </div>
              )
          )}
        </div>

        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full h-[132px]"
          preserveAspectRatio="none"
          role="img"
          aria-label={t("Funnel chart")}
        >
          <defs>
            <linearGradient id="funnelBody" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--accent-400))" stopOpacity="0.92" />
              <stop offset="50%" stopColor="hsl(var(--accent-400))" stopOpacity="0.5" />
              <stop offset="100%" stopColor="hsl(var(--accent-400))" stopOpacity="0.14" />
            </linearGradient>
          </defs>

          <path
            d={funnelPath}
            fill="url(#funnelBody)"
            stroke="hsl(var(--accent-400))"
            strokeOpacity="0.2"
            strokeWidth="1"
          />

          {hovered && (
            <path
              d={segmentHighlightPath(hovered, hoveredNext)}
              fill="hsl(var(--accent-400))"
              fillOpacity="0.18"
              stroke="hsl(var(--accent-400))"
              strokeOpacity="0.35"
              strokeWidth="1"
              pointerEvents="none"
            />
          )}

          {points.map(seg => (
            <rect
              key={seg.step.step_number}
              x={seg.hoverStart}
              y={0}
              width={seg.hoverEnd - seg.hoverStart}
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
            className="pointer-events-none absolute z-10 min-w-[180px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg px-3 py-2.5 text-xs"
            style={{
              left: `${(hovered.x / CHART_WIDTH) * 100}%`,
              top: "28px",
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