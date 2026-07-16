import { FilterParameter } from "@rybbit/shared";
import round from "lodash/round";
import { ChevronDown, ChevronRight, SquareArrowOutUpRight } from "lucide-react";
import { ReactNode, useState, useCallback } from "react";
import { usePaginatedMetric } from "../../../../../api/analytics/hooks/useGetMetric";
import { MetricResponse } from "../../../../../api/analytics/endpoints";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../../../components/ui/tooltip";
import { REVENUE_ATTRIBUTION } from "../../../../../lib/const";
import { addFilter, removeFilter, useStore } from "../../../../../lib/store";

function formatRevenue(cents: number | undefined): string {
  if (cents === undefined || cents <= 0) return "$0";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatRevenuePrecise(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Custom hook for filter handling logic
const useFilterToggle = () => {
  const filters = useStore(state => state.filters);

  const toggleFilter = useCallback(
    (parameter: FilterParameter, value: string) => {
      const foundFilter = filters.find(f => f.parameter === parameter && f.value.some(v => v === value));
      if (foundFilter) {
        removeFilter(foundFilter);
      } else {
        addFilter({
          parameter,
          value: [value],
          type: "equals",
        });
      }
    },
    [filters]
  );

  return toggleFilter;
};

/** Dual-scale bar: visitors (dataviz) + revenue (accent), DataFast-style. */
function DualMetricBar({
  visitorPct,
  revenuePct,
}: {
  visitorPct: number;
  revenuePct: number;
}) {
  const v = Math.max(0, Math.min(100, visitorPct));
  const r = Math.max(0, Math.min(100, revenuePct));
  // Overall length from the stronger metric; segments share that length by weight.
  const overall = Math.max(v, r, 0.5);
  const weight = v + r;
  const blueShare = weight > 0 ? (v / weight) * overall : 0;
  const accentShare = weight > 0 ? (r / weight) * overall : 0;

  return (
    <div className="absolute inset-y-0 left-0 right-0 flex items-stretch overflow-hidden">
      <div className="flex h-full items-stretch" style={{ width: `${overall}%` }}>
        {blueShare > 0 && (
          <div
            className="h-full bg-dataviz/30 dark:bg-dataviz/25"
            style={{ width: `${(blueShare / overall) * 100}%` }}
          />
        )}
        {accentShare > 0 && (
          <div
            className="h-full bg-emerald-500/35 dark:bg-emerald-500/30"
            style={{ width: `${(accentShare / overall) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

// Shared row item component
const RowItem = ({
  item,
  maxCount,
  maxRevenueCents,
  getKey,
  getLabel,
  getValue,
  getLink,
  filterParameter,
  onFilterToggle,
  leftContent,
  revenueCents,
}: {
  item: MetricResponse;
  maxCount: number;
  maxRevenueCents: number;
  getKey: (item: MetricResponse) => string;
  getLabel: (item: MetricResponse) => ReactNode;
  getValue: (item: MetricResponse) => string;
  getLink?: (item: MetricResponse) => string;
  filterParameter: FilterParameter;
  onFilterToggle: (parameter: FilterParameter, value: string) => void;
  leftContent?: ReactNode;
  revenueCents?: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const showRevenue = REVENUE_ATTRIBUTION && maxRevenueCents > 0;
  const rev = revenueCents ?? 0;
  const visitorPct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
  const revenuePct = showRevenue && maxRevenueCents > 0 ? (rev / maxRevenueCents) * 100 : 0;
  const revPerVisitor = item.count > 0 && rev > 0 ? rev / item.count : 0;

  const row = (
    <div
      key={getKey(item)}
      className="relative h-6 flex items-center cursor-pointer hover:bg-neutral-150/50 dark:hover:bg-neutral-850 group"
      onClick={() => onFilterToggle(filterParameter, getValue(item))}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {showRevenue ? (
        <DualMetricBar visitorPct={visitorPct} revenuePct={revenuePct} />
      ) : (
        <div
          className="absolute inset-0 bg-dataviz py-2 opacity-25 rounded-sm"
          style={{ width: `${visitorPct}%` }}
        />
      )}
      <div className="z-10 mx-2 flex justify-between items-center text-xs w-full gap-2">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {leftContent}
          <span className="truncate">{getLabel(item)}</span>
          {getLink && (
            <a
              href={getLink(item)}
              rel="noopener noreferrer"
              target="_blank"
              onClick={e => e.stopPropagation()}
              className="shrink-0"
            >
              <SquareArrowOutUpRight
                className="ml-0.5 w-3.5 h-3.5 text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
                strokeWidth={3}
              />
            </a>
          )}
        </div>
        <div className="text-xs flex gap-2 shrink-0 items-center">
          <div className="hidden group-hover:block text-neutral-600 dark:text-neutral-400">
            {round(item.percentage, 1)}%
          </div>
          {showRevenue && rev > 0 && (
            <span className="text-emerald-500 dark:text-emerald-400 font-medium tabular-nums min-w-[2.75rem] text-right">
              {formatRevenue(rev)}
            </span>
          )}
          <span className="tabular-nums min-w-[2rem] text-right">
            {isHovered
              ? item.count.toLocaleString()
              : item.count.toLocaleString(undefined, { notation: "compact" })}
          </span>
        </div>
      </div>
    </div>
  );

  if (!showRevenue) return row;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs space-y-1 min-w-[10rem]">
        <div className="font-medium mb-1.5 truncate max-w-[14rem]">{getValue(item)}</div>
        <div className="flex justify-between gap-6">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-[1px] bg-dataviz/80" />
            Visitors
          </span>
          <span className="tabular-nums">{item.count.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-[1px] bg-emerald-500/80" />
            Revenue
          </span>
          <span className="tabular-nums">{formatRevenue(rev)}</span>
        </div>
        {rev > 0 && item.count > 0 && (
          <div className="flex justify-between gap-6 pt-0.5 border-t border-neutral-700/50">
            <span className="text-muted-foreground">Rev / visitor</span>
            <span className="tabular-nums">{formatRevenuePrecise(revPerVisitor)}</span>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

const Subrows = ({
  getKey,
  getValue,
  getLink,
  filterParameter,
  filterValue,
  getSubrowLabel,
}: {
  getKey: (item: MetricResponse) => string;
  getValue: (item: MetricResponse) => string;
  getLink?: (item: MetricResponse) => string;
  filterParameter: FilterParameter;
  filterValue: string;
  getSubrowLabel?: (item: MetricResponse) => ReactNode;
}) => {
  const toggleFilter = useFilterToggle();
  const parameter = (filterParameter + "_version") as FilterParameter;

  const { data, isLoading, isFetching } = usePaginatedMetric({
    parameter,
    limit: 10,
    page: 1,
    additionalFilters: [
      {
        parameter: filterParameter,
        value: [filterValue],
        type: "equals",
      },
    ],
  });

  const itemsForDisplay = data?.data;
  const maxCount = itemsForDisplay?.[0]?.count ?? 1;

  if (isLoading || isFetching) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 pl-5 pt-2">
      {itemsForDisplay?.map(e => (
        <RowItem
          key={getKey(e)}
          item={e}
          maxCount={maxCount}
          maxRevenueCents={0}
          getKey={getKey}
          getLabel={getSubrowLabel || getValue}
          getValue={getValue}
          getLink={getLink}
          filterParameter={parameter}
          onFilterToggle={toggleFilter}
        />
      ))}
    </div>
  );
};

export const Row = ({
  e,
  maxCount,
  maxRevenueCents,
  getKey,
  getLabel,
  getValue,
  getLink,
  filterParameter,
  getSubrowLabel,
  hasSubrow,
  revenueCents,
}: {
  e: MetricResponse;
  maxCount: number;
  maxRevenueCents: number;
  getKey: (item: MetricResponse) => string;
  getLabel: (item: MetricResponse) => ReactNode;
  getValue: (item: MetricResponse) => string;
  getLink?: (item: MetricResponse) => string;
  filterParameter: FilterParameter;
  getSubrowLabel?: (item: MetricResponse) => ReactNode;
  hasSubrow?: boolean;
  revenueCents?: number;
}) => {
  const toggleFilter = useFilterToggle();
  const [expanded, setExpanded] = useState(false);

  const Icon = expanded ? ChevronDown : ChevronRight;

  const expandIcon = hasSubrow ? (
    <Icon
      className="w-4 h-4 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      strokeWidth={3}
      onClick={e => {
        e.stopPropagation();
        setExpanded(prev => !prev);
      }}
    />
  ) : null;

  return (
    <div className="flex flex-col">
      <RowItem
        item={e}
        maxCount={maxCount}
        maxRevenueCents={maxRevenueCents}
        getKey={getKey}
        getLabel={getLabel}
        getValue={getValue}
        getLink={getLink}
        filterParameter={filterParameter}
        onFilterToggle={toggleFilter}
        leftContent={expandIcon}
        revenueCents={revenueCents}
      />
      {hasSubrow && expanded && (
        <Subrows
          getKey={getKey}
          getValue={getValue}
          getLink={getLink}
          filterParameter={filterParameter}
          filterValue={getValue(e)}
          getSubrowLabel={getSubrowLabel}
        />
      )}
    </div>
  );
};
