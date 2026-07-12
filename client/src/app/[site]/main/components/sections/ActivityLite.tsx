"use client";

import { useExtracted } from "next-intl";
import { useGetEventNames } from "../../../../../api/analytics/hooks/events/useGetEventNames";
import { CardLoader } from "../../../../../components/ui/card";
import { ScrollArea } from "../../../../../components/ui/scroll-area";
import { EventList } from "../../../events/components/EventList";
import { TabbedSectionCard, type TabbedSectionItem } from "../../../components/shared/TabbedSectionCard";
import { SessionsLite } from "./SessionsLite";

type ActivityTab = "sessions" | "events";

function EventsActivity() {
  const t = useExtracted();
  const { data, isLoading } = useGetEventNames();

  return (
    <div className="relative pr-2">
      {isLoading && <CardLoader />}
      <div className="flex items-center justify-between pr-1 mb-2 text-xs text-neutral-600 dark:text-neutral-400">
        <span>{t("Custom Events")}</span>
        <span>{t("Count")}</span>
      </div>
      <ScrollArea className="h-[350px]">
        <EventList events={data || []} isLoading={isLoading} />
      </ScrollArea>
    </div>
  );
}

export function ActivityLite() {
  const t = useExtracted();
  const tabs: TabbedSectionItem<ActivityTab>[] = [
    { value: "sessions", label: t("Sessions"), content: <SessionsLite embedded /> },
    { value: "events", label: t("Events"), content: <EventsActivity /> },
  ];

  return <TabbedSectionCard defaultValue="sessions" tabs={tabs} expandable={false} className="h-[405px]" />;
}
