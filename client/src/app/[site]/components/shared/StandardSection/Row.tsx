import { FilterParameter } from "@rybbit/shared";
import round from "lodash/round";
import { ChevronDown, ChevronRight, SquareArrowOutUpRight } from "lucide-react";
import { ReactNode, useState, useCallback } from "react";
import { usePaginatedMetric } from "../../../../../api/analytics/hooks/useGetMetric";
import { MetricResponse } from "../../../../../api/analytics/endpoints";
import { REVENUE_ATTRIBUTION } from "../../../../../lib/const";
import { addFilter, removeFilter, useStore } from "../../../../../lib/store";

function formatRevenue(cents: number | undefined): string | null {
  if (cents === undefined || cents <= 0) return null;
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

// Shared row item component
const RowItem = ({
  item,
  ratio,
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
  ratio: number;
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
  const revenueLabel = REVENUE_ATTRIBUTION ? formatRevenue(revenueCents) : null;

  return (
    <div
      key={getKey(item)}
      className="relative h-6 flex items-center cursor-pointer hover:bg-neutral-150/50 dark:hover:bg-neutral-850 group"
      onClick={() => onFilterToggle(filterParameter, getValue(item))}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="absolute inset-0 bg-dataviz py-2 opacity-25 rounded-md"
        style={{ width: `${item.percentage * ratio}%` }}
      ></div>
      <div className="z-10 mx-2 flex justify-between items-center text-xs w-full gap-2">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {leftContent}
          <span className="truncate">{getLabel(item)}</span>
          {getLink && (
            <a href={getLink(item)} rel="noopener noreferrer" target="_blank" onClick={e => e.stopPropagation()} className="shrink-0">
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
          {revenueLabel && (
            <span className="text-accent-400 font-medium tabular-nums min-w-[3rem] text-right">
              {revenueLabel}
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

  const ratio = itemsForDisplay?.[0]?.percentage ? 100 / itemsForDisplay[0].percentage : 1;

  if (isLoading || isFetching) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 pl-5 pt-2">
      {itemsForDisplay?.map(e => (
        <RowItem
          key={getKey(e)}
          item={e}
          ratio={ratio}
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
  ratio,
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
  ratio: number;
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
        ratio={ratio}
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
