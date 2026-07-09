"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ArrowRight } from "lucide-react";
import { DateTime } from "luxon";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useMemo, useState } from "react";
import { useGetSessions } from "../../../../../api/analytics/hooks/useGetUserSessions";
import { GetSessionsResponse } from "../../../../../api/analytics/endpoints";
import { Avatar, generateName } from "../../../../../components/Avatar";
import { Channel } from "../../../../../components/Channel";
import { EventIcon, PageviewIcon } from "../../../../../components/EventIcons";
import { SessionCard as FullSessionCard } from "../../../../../components/Sessions/SessionCard";
import {
  BrowserTooltipIcon,
  CountryFlagTooltipIcon,
  DeviceTypeTooltipIcon,
  OperatingSystemTooltipIcon,
} from "../../../../../components/TooltipIcons/TooltipIcons";
import { Badge } from "../../../../../components/ui/badge";
import { Card, CardContent, CardLoader } from "../../../../../components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "../../../../../components/ui/dialog";
import { ScrollArea } from "../../../../../components/ui/scroll-area";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../../../components/ui/tooltip";
import { useDateTimeFormat } from "../../../../../hooks/useDateTimeFormat";
import { formatShortDuration } from "../../../../../lib/dateTimeUtils";
import { getTimezone } from "../../../../../lib/store";
import { cn, formatter, truncateString } from "../../../../../lib/utils";

const VISIBLE_ROWS = 4;
const ROW_HEIGHT_PX = 88;
const FETCH_COUNT = 20;

function SessionPreviewCard({
  session,
  onClick,
}: {
  session: GetSessionsResponse[number];
  onClick: () => void;
}) {
  const t = useExtracted();
  const { hour12, formatDateTime } = useDateTimeFormat();
  const start = DateTime.fromSQL(session.session_start, { zone: "utc" });
  const end = DateTime.fromSQL(session.session_end, { zone: "utc" });
  const totalSeconds = Math.floor(end.diff(start).milliseconds / 1000);
  const duration = formatShortDuration(totalSeconds);
  const name = generateName(session.user_id);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border border-neutral-100 dark:border-neutral-800",
        "bg-neutral-50/50 dark:bg-neutral-850/40 p-2.5 space-y-2",
        "hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
      )}
      style={{ minHeight: ROW_HEIGHT_PX }}
    >
      <div className="flex justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar id={session.user_id} size={16} />
          <span className="text-xs font-medium truncate">{name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <span>
            {formatDateTime(start.setZone(getTimezone()), {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12,
            })}
          </span>
          <span>•</span>
          <span>{duration}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {session.country && (
          <CountryFlagTooltipIcon country={session.country} city={session.city} region={session.region} />
        )}
        <BrowserTooltipIcon browser={session.browser || "Unknown"} browser_version={session.browser_version} />
        <OperatingSystemTooltipIcon
          operating_system={session.operating_system || ""}
          operating_system_version={session.operating_system_version}
        />
        <DeviceTypeTooltipIcon
          device_type={session.device_type || ""}
          screen_width={session.screen_width}
          screen_height={session.screen_height}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="flex items-center gap-1 h-5 px-1.5">
              <PageviewIcon />
              <span className="text-xs">{formatter(session.pageviews)}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{t("Pageviews")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="flex items-center gap-1 h-5 px-1.5">
              <EventIcon />
              <span className="text-xs">{formatter(session.events)}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{t("Events")}</TooltipContent>
        </Tooltip>
        <Channel channel={session.channel} referrer={session.referrer} />
      </div>
      <div className="hidden md:flex items-center gap-2 min-w-0 text-xs text-muted-foreground">
        <span className="truncate max-w-[140px]">{truncateString(session.entry_page, 32)}</span>
        <ArrowRight className="w-3 h-3 shrink-0" />
        <span className="truncate max-w-[140px]">{truncateString(session.exit_page, 32)}</span>
      </div>
    </button>
  );
}

export function SessionsLite() {
  const t = useExtracted();
  const { site } = useParams();
  const [selectedSession, setSelectedSession] = useState<GetSessionsResponse[number] | null>(null);
  const { data, isLoading, isFetching } = useGetSessions({ page: 1, limit: FETCH_COUNT });

  const sessions = useMemo(() => data?.data ?? [], [data?.data]);

  return (
    <>
      <Card>
        {isFetching && <CardLoader />}
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">{t("Sessions")}</h3>
            <Link
              href={`/${site}/sessions`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("View all")}
            </Link>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: VISIBLE_ROWS }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">{t("No sessions in this period")}</p>
          ) : (
            <ScrollArea
              className="w-full px-3 py-3"
              style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT_PX + 24 }}
              viewportClassName="max-h-[inherit]"
            >
              <div className="space-y-2">
                {sessions.map(session => (
                  <SessionPreviewCard
                    key={session.session_id}
                    session={session}
                    onClick={() => setSelectedSession(session)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedSession} onOpenChange={open => !open && setSelectedSession(null)}>
        <VisuallyHidden>
          <DialogTitle>{t("Session Details")}</DialogTitle>
        </VisuallyHidden>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-transparent border-0 p-0 shadow-none gap-0 [&>button]:hidden">
          {selectedSession && <FullSessionCard session={selectedSession} expandedByDefault />}
        </DialogContent>
      </Dialog>
    </>
  );
}