"use client";

import * as d3 from "d3";
import round from "lodash/round";
import { useExtracted } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { Filter } from "@rybbit/shared";
import { fetchMetricLite } from "../../../../../api/analytics/endpoints";
import { useMetric } from "../../../../../api/analytics/hooks/useGetMetric";
import { buildApiParams } from "../../../../../api/utils";
import { ChannelIcon, getDisplayName } from "../../../../../components/Channel";
import { ChartTooltip } from "../../../../../components/charts/ChartTooltip";
import { Favicon } from "../../../../../components/Favicon";
import { useStore } from "../../../../../lib/store";
import { formatter } from "../../../../../lib/utils";
import { CARD_PALETTE } from "../../../dashboards/utils";
import { StandardSection } from "../../../components/shared/StandardSection/StandardSection";

const MAX_SLICES = 6;

type ChannelSlice = {
  value: string;
  label: string;
  count: number;
  share: number;
  members?: string[];
};

const CHANNEL_COLORS: Record<string, string> = {
  Direct: "hsl(0 0% 42%)",
  "Organic Search": "hsl(var(--dataviz))",
  "Paid Search": "hsla(190, 78%, 52%, 0.9)",
  "Organic Social": "hsla(142, 65%, 48%, 0.9)",
  "Paid Social": "hsla(160, 58%, 48%, 0.9)",
  Referral: "hsla(24, 80%, 60%, 0.9)",
  AI: "hsla(280, 62%, 62%, 0.9)",
  "Paid AI": "hsla(280, 62%, 52%, 0.9)",
  Email: "hsla(48, 80%, 55%, 0.9)",
  "Organic Video": "hsla(340, 70%, 62%, 0.9)",
};

function sliceColor(channel: string, index: number): string {
  return CHANNEL_COLORS[channel] ?? CARD_PALETTE[index % CARD_PALETTE.length];
}

function sharePercent(count: number, total: number): number {
  return total > 0 ? round((count / total) * 100, 1) : 0;
}

function buildSlices(
  items: { value: string; count: number }[],
  directLabel: string
): ChannelSlice[] {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, item) => sum + item.count, 0);

  if (sorted.length <= MAX_SLICES) {
    return sorted.map(item => ({
      value: item.value || "Direct",
      label: item.value || directLabel,
      count: item.count,
      share: sharePercent(item.count, total),
    }));
  }

  const visible = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1);
  const otherCount = rest.reduce((sum, item) => sum + item.count, 0);

  return [
    ...visible.map(item => ({
      value: item.value || "Direct",
      label: item.value || directLabel,
      count: item.count,
      share: sharePercent(item.count, total),
    })),
    {
      value: "Other",
      label: "Other",
      count: otherCount,
      share: sharePercent(otherCount, total),
      members: rest.map(item => item.value || "Direct"),
    },
  ];
}

function ChannelHoverPanel({
  slice,
  color,
  sources,
  isLoadingSources,
  otherBreakdown,
  directLabel,
  topSourcesLabel,
  breakdownLabel,
  totalVisitors,
}: {
  slice: ChannelSlice;
  color: string;
  sources: { value: string; count: number }[];
  isLoadingSources: boolean;
  otherBreakdown: { value: string; count: number }[];
  directLabel: string;
  topSourcesLabel: string;
  breakdownLabel: string;
  totalVisitors: number;
}) {
  const showReferrers = slice.value !== "Other";
  const list = showReferrers ? sources : otherBreakdown;
  const sectionLabel = showReferrers ? topSourcesLabel : breakdownLabel;

  return (
    <ChartTooltip className="w-[220px]">
      <div className="px-3 py-2.5">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate text-xs font-medium text-neutral-900 dark:text-neutral-100">{slice.label}</span>
        </div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
            {formatter(slice.count)}
          </span>
          <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            {sharePercent(slice.count, totalVisitors)}%
          </span>
        </div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {sectionLabel}
        </p>
        {isLoadingSources ? (
          <p className="text-xs text-neutral-500">…</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-neutral-500">—</p>
        ) : (
          <ul className="space-y-1.5">
            {list.slice(0, 5).map(source => {
              const domain = source.value;
              const isChannelRow = !showReferrers;
              const name = isChannelRow ? domain || directLabel : domain ? getDisplayName(domain) : directLabel;
              return (
                <li
                  key={(isChannelRow ? "ch:" : "ref:") + (domain || directLabel)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {isChannelRow ? (
                      <ChannelIcon channel={domain || "Direct"} className="h-3.5 w-3.5 shrink-0" />
                    ) : domain ? (
                      <Favicon domain={domain} className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChannelIcon channel="Direct" className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="truncate text-xs text-neutral-600 dark:text-neutral-300">{name}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                    {sharePercent(source.count, slice.count)}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ChartTooltip>
  );
}

function ChannelsMobileSection() {
  const t = useExtracted();

  return (
    <StandardSection
      filterParameter="channel"
      title={t("Channels")}
      getValue={e => e.value}
      getKey={e => e.value}
      getLabel={e => (
        <div className="flex items-center gap-2">
          <ChannelIcon channel={e.value} />
          {e.value || t("Direct")}
        </div>
      )}
      lite
      renderDialog={false}
    />
  );
}

type ArcLayout = {
  path: string;
  index: number;
  iconX: number;
  iconY: number;
  largeEnough: boolean;
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "end";
  linePath: string;
};

export function ChannelDonut() {
  const t = useExtracted();
  const directLabel = t("Direct");
  const topSourcesLabel = t("Top sources");
  const breakdownLabel = t("Channels");
  const { data, isLoading } = useMetric({ parameter: "channel", limit: 100 });
  const { time, site, filters } = useStore();

  const slices = useMemo(() => buildSlices(data?.data ?? [], directLabel), [data?.data, directLabel]);

  const total = useMemo(() => slices.reduce((sum, slice) => sum + slice.count, 0), [slices]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [hover, setHover] = useState<{ index: number; clientX: number; clientY: number } | null>(null);
  const activeSlice = hover !== null ? slices[hover.index] : null;

  const channelFilter: Filter[] | undefined = useMemo(() => {
    if (!activeSlice || activeSlice.value === "Other") return undefined;
    return [{ parameter: "channel", type: "equals", value: [activeSlice.value] }];
  }, [activeSlice]);

  const { data: referrerData, isLoading: isLoadingSources } = useQuery({
    queryKey: ["channel-donut-referrers", site, time, filters, channelFilter],
    queryFn: async () => {
      const params = buildApiParams(time, {
        filters: [...filters, ...(channelFilter ?? [])],
      });
      return fetchMetricLite(site, { ...params, parameter: "referrer", limit: 8 });
    },
    enabled: !!site && !!channelFilter,
    staleTime: 60_000,
  });

  const otherBreakdown = useMemo(() => {
    if (!activeSlice?.members?.length || !data?.data) return [];
    const memberSet = new Set(activeSlice.members);
    return data.data
      .filter(item => memberSet.has(item.value || "Direct"))
      .sort((a, b) => b.count - a.count);
  }, [activeSlice, data?.data]);

  const arcs = useMemo((): ArcLayout[] => {
    if (size.width === 0 || size.height === 0 || total === 0) return [];

    const labelPadding = 36;
    const radius = Math.max(0, Math.min(size.width, size.height) / 2 - labelPadding);
    const innerRadius = radius * 0.52;
    const outerRadius = radius;

    const arcGen = d3
      .arc<d3.PieArcDatum<number>>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .padAngle(0.02)
      .cornerRadius(2);

    const pieGen = d3
      .pie<number>()
      .sort(null)
      .value(value => value);

    const pieData = pieGen(slices.map(slice => slice.count));
    const midArc = d3
      .arc<d3.PieArcDatum<number>>()
      .innerRadius((innerRadius + outerRadius) / 2)
      .outerRadius((innerRadius + outerRadius) / 2);

    const labelRadius = outerRadius + 14;
    const labelArc = d3
      .arc<d3.PieArcDatum<number>>()
      .innerRadius(labelRadius)
      .outerRadius(labelRadius);

    return pieData.map(datum => {
      const [iconX, iconY] = midArc.centroid(datum);
      const [labelX, labelY] = labelArc.centroid(datum);
      const angle = (datum.startAngle + datum.endAngle) / 2;
      const lineStartX = Math.sin(angle) * outerRadius;
      const lineStartY = -Math.cos(angle) * outerRadius;
      const lineEndX = Math.sin(angle) * (outerRadius + 8);
      const lineEndY = -Math.cos(angle) * (outerRadius + 8);

      return {
        path: arcGen(datum) ?? "",
        index: datum.index,
        iconX,
        iconY,
        largeEnough: datum.endAngle - datum.startAngle > 0.28,
        labelX,
        labelY,
        labelAnchor: labelX >= 0 ? "start" : "end",
        linePath: `M${lineStartX},${lineStartY} L${lineEndX},${lineEndY} L${labelX},${labelY}`,
      };
    });
  }, [slices, size, total]);

  const viewportW = typeof window !== "undefined" ? window.innerWidth : 0;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 0;
  const tooltipWidth = 220;
  const tooltipLeft = hover ? Math.min(hover.clientX + 14, viewportW - tooltipWidth - 8) : 0;
  const tooltipTop = hover ? Math.min(hover.clientY + 14, viewportH - 200) : 0;

  return (
    <>
      <div className="sm:hidden">
        <ChannelsMobileSection />
      </div>

      <div ref={wrapperRef} className="relative hidden h-[350px] overflow-hidden sm:flex sm:items-center sm:justify-center">
        {isLoading && total === 0 ? (
          <div className="h-40 w-40 animate-pulse rounded-full border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-850" />
        ) : total === 0 ? (
          <div className="text-sm text-neutral-500">{t("No channel data available")}</div>
        ) : (
          size.width > 0 &&
          size.height > 0 && (
            <svg width={size.width} height={size.height} className="block max-w-full" aria-label={t("Channel distribution")}>
              <g transform={`translate(${size.width / 2}, ${size.height / 2})`}>
                {arcs.map(arc => {
                  const slice = slices[arc.index];
                  const color = sliceColor(slice.value, arc.index);
                  const isActive = hover?.index === arc.index;
                  const dimmed = hover !== null && !isActive;

                  return (
                    <g key={slice.value + arc.index}>
                      <path
                        d={arc.path}
                        fill={color}
                        opacity={dimmed ? 0.35 : 1}
                        className="cursor-pointer transition-opacity"
                        onMouseMove={event =>
                          setHover({ index: arc.index, clientX: event.clientX, clientY: event.clientY })
                        }
                        onMouseLeave={() => setHover(null)}
                      />
                      <path
                        d={arc.linePath}
                        fill="none"
                        stroke="currentColor"
                        strokeOpacity={dimmed ? 0.2 : 0.35}
                        className="pointer-events-none text-neutral-400"
                      />
                      <text
                        x={arc.labelX}
                        y={arc.labelY}
                        textAnchor={arc.labelAnchor}
                        dominantBaseline="middle"
                        className="pointer-events-none fill-neutral-600 text-[11px] dark:fill-neutral-300"
                        opacity={dimmed ? 0.45 : 1}
                      >
                        {slice.label}
                      </text>
                      {arc.largeEnough && (
                        <g
                          transform={`translate(${arc.iconX}, ${arc.iconY})`}
                          className="pointer-events-none text-neutral-900 dark:text-neutral-100"
                          opacity={dimmed ? 0.4 : 0.95}
                        >
                          <foreignObject x={-8} y={-8} width={16} height={16}>
                            <div className="flex h-4 w-4 items-center justify-center">
                              <ChannelIcon
                                channel={slice.value === "Other" ? "Unknown" : slice.value}
                                className="h-3.5 w-3.5"
                              />
                            </div>
                          </foreignObject>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )
        )}

        {hover !== null &&
          activeSlice &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              style={{
                position: "fixed",
                left: tooltipLeft,
                top: tooltipTop,
                width: tooltipWidth,
                pointerEvents: "none",
                zIndex: 9999,
              }}
            >
              <ChannelHoverPanel
                slice={activeSlice}
                color={sliceColor(activeSlice.value, hover.index)}
                sources={referrerData?.data ?? []}
                isLoadingSources={isLoadingSources}
                otherBreakdown={otherBreakdown}
                directLabel={directLabel}
                topSourcesLabel={topSourcesLabel}
                breakdownLabel={breakdownLabel}
                totalVisitors={total}
              />
            </div>,
            document.body
          )}
      </div>
    </>
  );
}
