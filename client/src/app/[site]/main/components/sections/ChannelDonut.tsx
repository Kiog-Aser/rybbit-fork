"use client";

import * as d3 from "d3";
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
import { addFilter, removeFilter, useStore } from "../../../../../lib/store";
import { cn, formatter } from "../../../../../lib/utils";
import { CARD_PALETTE } from "../../../dashboards/utils";

const MAX_SLICES = 7;

type ChannelSlice = {
  value: string;
  label: string;
  count: number;
  percentage: number;
  /** Channel names rolled into an "Other" slice */
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

function buildSlices(
  items: { value: string; count: number; percentage: number }[],
  directLabel: string
): ChannelSlice[] {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  if (sorted.length <= MAX_SLICES) {
    return sorted.map(item => ({
      value: item.value || "Direct",
      label: item.value || directLabel,
      count: item.count,
      percentage: item.percentage,
    }));
  }

  const visible = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1);
  const otherCount = rest.reduce((sum, item) => sum + item.count, 0);
  const otherPercentage = rest.reduce((sum, item) => sum + item.percentage, 0);

  return [
    ...visible.map(item => ({
      value: item.value || "Direct",
      label: item.value || directLabel,
      count: item.count,
      percentage: item.percentage,
    })),
    {
      value: "Other",
      label: "Other",
      count: otherCount,
      percentage: otherPercentage,
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
}: {
  slice: ChannelSlice;
  color: string;
  sources: { value: string; count: number; percentage: number }[];
  isLoadingSources: boolean;
  otherBreakdown: { value: string; count: number; percentage: number }[];
  directLabel: string;
  topSourcesLabel: string;
  breakdownLabel: string;
}) {
  const showReferrers = slice.value !== "Other";
  const list = showReferrers ? sources : otherBreakdown;
  const sectionLabel = showReferrers ? topSourcesLabel : breakdownLabel;

  return (
    <ChartTooltip className="w-[220px]">
      <div className="px-3 py-2.5">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <ChannelIcon channel={slice.value === "Other" ? "Unknown" : slice.value} className="h-3.5 w-3.5" />
          <span className="truncate text-xs font-medium text-neutral-900 dark:text-neutral-100">{slice.label}</span>
        </div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
            {formatter(slice.count)}
          </span>
          <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            {Math.round(slice.percentage * 100)}%
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
                <li key={(isChannelRow ? "ch:" : "ref:") + (domain || directLabel)} className="flex items-center justify-between gap-2">
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
                    {Math.round(source.percentage * 100)}%
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

function ChannelMobileList({
  items,
  directLabel,
  isLoading,
  emptyLabel,
}: {
  items: { value: string; count: number; percentage: number }[];
  directLabel: string;
  isLoading: boolean;
  emptyLabel: string;
}) {
  const filters = useStore(state => state.filters);

  function toggleChannelFilter(channel: string) {
    const found = filters.find(f => f.parameter === "channel" && f.value.includes(channel));
    if (found) {
      removeFilter(found);
    } else {
      addFilter({ parameter: "channel", value: [channel], type: "equals" });
    }
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-2 px-1 pt-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-6 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-850" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="px-2 py-4 text-sm text-neutral-500">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-0">
      {items.map(item => {
        const channel = item.value || "Direct";
        const label = item.value || directLabel;
        return (
          <div
            key={channel}
            role="button"
            tabIndex={0}
            className="relative flex h-6 cursor-pointer items-center hover:bg-neutral-150/50 dark:hover:bg-neutral-850"
            onClick={() => toggleChannelFilter(channel)}
            onKeyDown={event => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleChannelFilter(channel);
              }
            }}
          >
            <div
              className="absolute inset-0 rounded-md bg-dataviz opacity-25"
              style={{ width: `${Math.round(item.percentage * 100)}%` }}
            />
            <div className="z-10 mx-2 flex w-full items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <ChannelIcon channel={channel} className="h-4 w-4 shrink-0" />
                <span className="truncate text-neutral-700 dark:text-neutral-200">{label}</span>
              </div>
              <span className="shrink-0 tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
                {formatter(item.count)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChannelDonut() {
  const t = useExtracted();
  const directLabel = t("Direct");
  const topSourcesLabel = t("Top sources");
  const breakdownLabel = t("Channels");
  const { data, isLoading } = useMetric({ parameter: "channel", limit: 100 });
  const { time, site, filters } = useStore();

  const slices = useMemo(
    () => buildSlices(data?.data ?? [], directLabel),
    [data?.data, directLabel]
  );

  const mobileItems = useMemo(
    () => [...(data?.data ?? [])].sort((a, b) => b.count - a.count),
    [data?.data]
  );

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

  const arcs = useMemo(() => {
    if (size.width === 0 || size.height === 0 || total === 0) return [];
    const radius = Math.max(0, Math.min(size.width, size.height) / 2 - 8);
    const arcGen = d3
      .arc<d3.PieArcDatum<number>>()
      .innerRadius(radius * 0.68)
      .outerRadius(radius)
      .padAngle(0.015)
      .cornerRadius(2);
    const pieGen = d3
      .pie<number>()
      .sort(null)
      .value(value => value);
    const pieData = pieGen(slices.map(slice => slice.count));
    return pieData.map(datum => {
      const midArc = d3
        .arc<d3.PieArcDatum<number>>()
        .innerRadius(radius * 0.84)
        .outerRadius(radius * 0.84);
      const [iconX, iconY] = midArc.centroid(datum);
      return {
        path: arcGen(datum) ?? "",
        index: datum.index,
        iconX,
        iconY,
        largeEnough: datum.endAngle - datum.startAngle > 0.35,
      };
    });
  }, [slices, size, total]);

  const viewportW = typeof window !== "undefined" ? window.innerWidth : 0;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 0;
  const tooltipWidth = 220;
  const tooltipLeft = hover ? Math.min(hover.clientX + 14, viewportW - tooltipWidth - 8) : 0;
  const tooltipTop = hover ? Math.min(hover.clientY + 14, viewportH - 200) : 0;

  function setHoverIndex(index: number, event?: { clientX: number; clientY: number }) {
    if (event) {
      setHover({ index, clientX: event.clientX, clientY: event.clientY });
      return;
    }
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) {
      setHover({ index, clientX: rect.right - 8, clientY: rect.top + rect.height / 2 });
    }
  }

  return (
    <>
      <div className="h-[350px] overflow-y-auto sm:hidden">
        <ChannelMobileList
          items={mobileItems}
          directLabel={directLabel}
          isLoading={isLoading}
          emptyLabel={t("No channel data available")}
        />
      </div>

      <div className="hidden h-[350px] sm:flex sm:flex-row sm:gap-6">
      <div ref={wrapperRef} className="relative min-h-[180px] w-full max-w-[220px] flex-1 sm:mx-0 sm:max-w-none">
        {isLoading && total === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-36 w-36 animate-pulse rounded-full border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-850" />
          </div>
        ) : total === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">{t("No channel data available")}</div>
        ) : (
          size.width > 0 &&
          size.height > 0 && (
            <svg width={size.width} height={size.height} className="block" aria-label={t("Channel distribution")}>
              <g transform={`translate(${size.width / 2}, ${size.height / 2})`}>
                {arcs.map(arc => {
                  const slice = slices[arc.index];
                  const color = sliceColor(slice.value, arc.index);
                  const isActive = hover?.index === arc.index;
                  return (
                    <g key={slice.value + arc.index}>
                      <path
                        d={arc.path}
                        fill={color}
                        opacity={hover && !isActive ? 0.4 : 1}
                        className="cursor-pointer transition-opacity"
                        onMouseMove={event => setHoverIndex(arc.index, event)}
                        onMouseLeave={() => setHover(null)}
                      />
                      {arc.largeEnough && (
                        <g
                          transform={`translate(${arc.iconX}, ${arc.iconY})`}
                          className="pointer-events-none text-neutral-900 dark:text-neutral-100"
                          opacity={hover && !isActive ? 0.45 : 0.9}
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
              />
            </div>,
            document.body
          )}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5 overflow-y-auto">
        {slices.map((slice, index) => {
          const color = sliceColor(slice.value, index);
          const isActive = hover?.index === index;
          return (
            <button
              key={slice.value + index}
              type="button"
              className={cn(
                "relative flex h-6 w-full items-center rounded-md px-2 text-left text-xs transition-colors",
                isActive
                  ? "bg-neutral-150/70 dark:bg-neutral-850"
                  : "hover:bg-neutral-150/50 dark:hover:bg-neutral-850/60"
              )}
              onMouseEnter={event => setHoverIndex(index, event)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => {
                const rect = wrapperRef.current?.getBoundingClientRect();
                if (rect) setHover({ index, clientX: rect.right - 8, clientY: rect.top + rect.height / 2 });
              }}
              onBlur={() => setHover(null)}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-dataviz opacity-20"
                style={{ width: `${Math.round(slice.percentage * 100)}%` }}
              />
              <span className="z-10 flex min-w-0 flex-1 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <ChannelIcon channel={slice.value === "Other" ? "Unknown" : slice.value} className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-neutral-700 dark:text-neutral-200">{slice.label}</span>
              </span>
              <span className="z-10 shrink-0 pl-2 tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
                {formatter(slice.count)}
              </span>
            </button>
          );
        })}
      </div>
      </div>
    </>
  );
}
