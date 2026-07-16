"use client";

import { DateTime } from "luxon";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useGetUsers } from "../../../../../api/analytics/hooks/useGetUsers";
import { Avatar, generateName } from "../../../../../components/Avatar";
import { ChannelIcon, extractDomain, getDisplayName } from "../../../../../components/Channel";
import { Card, CardContent, CardLoader } from "../../../../../components/ui/card";
import { ScrollArea } from "../../../../../components/ui/scroll-area";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { useDateTimeFormat } from "../../../../../hooks/useDateTimeFormat";
import { getTimezone } from "../../../../../lib/store";
import { getCountryName, getUserDisplayName } from "../../../../../lib/utils";
import { Browser } from "../../../components/shared/icons/Browser";
import { CountryFlag } from "../../../components/shared/icons/CountryFlag";
import { DeviceIcon } from "../../../components/shared/icons/Device";
import { OperatingSystem } from "../../../components/shared/icons/OperatingSystem";

const VISIBLE_ROWS = 4;
const ROW_HEIGHT_PX = 68;
const FETCH_COUNT = 20;

export function UsersLite() {
  const t = useExtracted();
  const { site } = useParams();
  const { formatRelative } = useDateTimeFormat();
  const { data, isLoading, isFetching } = useGetUsers({
    page: 1,
    pageSize: FETCH_COUNT,
    sortBy: "last_seen",
    sortOrder: "desc",
  });

  const users = data?.data ?? [];

  return (
    <Card>
      {isFetching && <CardLoader />}
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-sm font-semibold">{t("Users")}</h3>
          <Link
            href={`/${site}/users`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("View all")}
          </Link>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: VISIBLE_ROWS }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">{t("No users in this period")}</p>
        ) : (
          <ScrollArea
            className="w-full"
            style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT_PX }}
            viewportClassName="max-h-[inherit]"
          >
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {users.map(user => {
                const displayName = getUserDisplayName(user) || generateName(user.user_id);
                const lastSeen = DateTime.fromSQL(user.last_seen, { zone: "utc" }).setZone(getTimezone());
                const referrerDomain = extractDomain(user.referrer);
                const channelLabel = referrerDomain ? getDisplayName(referrerDomain) : user.channel || t("Direct");

                const personId = user.identified_user_id || user.user_id;
                return (
                  <Link
                    key={personId}
                    href={`/${site}/user/${encodeURIComponent(personId)}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors"
                    style={{ minHeight: ROW_HEIGHT_PX }}
                  >
                    <Avatar id={personId} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{displayName}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {user.country && (
                          <span className="inline-flex items-center gap-1">
                            <CountryFlag country={user.country} />
                            {getCountryName(user.country)}
                          </span>
                        )}
                        <DeviceIcon deviceType={user.device_type || ""} size={14} />
                        <OperatingSystem os={user.operating_system || ""} size={14} />
                        <Browser browser={user.browser || ""} size={14} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right space-y-1">
                      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                        <ChannelIcon channel={user.channel} />
                        <span className="max-w-[100px] truncate">{channelLabel}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{formatRelative(lastSeen)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}