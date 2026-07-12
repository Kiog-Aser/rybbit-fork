"use client";
import { useExtracted } from "next-intl";
import { useMemo, useState } from "react";
import { useMetric } from "../../../../../api/analytics/hooks/useGetMetric";
import { ChannelIcon } from "../../../../../components/Channel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../../../components/ui/tooltip";

const COLORS = ["#82b8e8", "#4d83ad", "#cc785c", "#8fae8b", "#b19cd9", "#d4a85c"];
type ChannelGroup = { label: string; total: number; sources: { label: string; count: number }[] };

function getGroup(channel: string) {
  const value = channel.toLowerCase();
  if (!value || value === "direct") return "Direct";
  if (/chatgpt|openai|claude|anthropic|perplexity|copilot|gemini|mistral|you\.com/.test(value)) return "AI";
  if (/google|bing|duckduckgo|yandex|baidu/.test(value)) return "Search";
  if (/facebook|instagram|linkedin|twitter|x\.com|reddit|tiktok/.test(value)) return "Social";
  return "Referral";
}

export function ChannelDonut() {
  const t = useExtracted();
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading } = useMetric({ parameter: "channel", limit: 100 });
  const groups = useMemo<ChannelGroup[]>(() => {
    const grouped = new Map<string, ChannelGroup>();
    for (const item of data?.data ?? []) {
      const label = getGroup(item.value);
      const group = grouped.get(label) ?? { label, total: 0, sources: [] };
      group.total += item.count;
      group.sources.push({ label: item.value || t("Direct"), count: item.count });
      grouped.set(label, group);
    }
    return [...grouped.values()].sort((a, b) => b.total - a.total);
  }, [data?.data, t]);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  let offset = 0;
  const gradient = groups
    .map((group, index) => {
      const start = total ? (offset / total) * 100 : 0;
      offset += group.total;
      const end = total ? (offset / total) * 100 : 100;
      return `${COLORS[index % COLORS.length]} ${start}% ${end}%`;
    })
    .join(", ");
  const active = groups.find(group => group.label === selected) ?? groups[0];

  return (
    <TooltipProvider>
      <div className="flex h-[350px] flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
        <div
          className="relative h-44 w-44 shrink-0 rounded-full"
          style={{ background: total ? `conic-gradient(${gradient})` : "hsl(var(--muted))" }}
          aria-label={t("Channel distribution")}
        >
          <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-card text-center">
            <span className="text-2xl font-semibold">{isLoading ? "—" : total.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">{t("Visitors")}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {groups.length === 0 && !isLoading ? (
            <p className="text-sm text-muted-foreground">{t("No channel data available")}</p>
          ) : (
            groups.map((group, index) => (
              <Tooltip key={group.label}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                    onMouseEnter={() => setSelected(group.label)}
                    onFocus={() => setSelected(group.label)}
                    onMouseLeave={() => setSelected(null)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <ChannelIcon channel={group.label} />
                      <span className="truncate">{group.label}</span>
                    </span>
                    <span className="pl-3 font-medium">{group.total.toLocaleString()}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p className="font-semibold">{group.label}</p>
                    {group.sources.slice(0, 5).map(source => (
                      <p key={source.label} className="text-xs">
                        {source.label}: {source.count.toLocaleString()}
                      </p>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))
          )}
          {active && (
            <div className="pt-2 text-xs text-muted-foreground">
              {active.sources.length} {t("sources")} · {total ? Math.round((active.total / total) * 100) : 0}%
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
