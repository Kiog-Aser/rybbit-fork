"use client";

import { useExtracted } from "next-intl";
import { ChannelIcon } from "../../../../../components/Channel";
import { Favicon } from "../../../../../components/Favicon";
import {
  StandardSectionTabs,
  type StandardSectionTab,
} from "../../../components/shared/StandardSection/StandardSectionTabs";

type Tab = "channels" | "referrers";

export function ReferrersLite() {
  const t = useExtracted();

  const tabs: StandardSectionTab<Tab>[] = [
    {
      value: "channels",
      label: t("Channels"),
      section: {
        filterParameter: "channel",
        title: t("Channels"),
        getValue: e => e.value,
        getKey: e => e.value,
        getLabel: e => (
          <div className="flex items-center gap-2">
            <ChannelIcon channel={e.value} />
            {e.value || t("Direct")}
          </div>
        ),
        lite: true,
      },
    },
    {
      value: "referrers",
      label: t("Referrers"),
      section: {
        filterParameter: "referrer",
        title: t("Referrers"),
        getValue: e => e.value,
        getKey: e => e.value,
        getLink: e => (e.value ? `https://${e.value}` : "#"),
        getLabel: e => (
          <div className="flex items-center">
            {e.value ? <Favicon domain={e.value} className="w-4 mr-2" /> : null}
            {e.value || t("Direct")}
          </div>
        ),
        lite: true,
      },
    },
  ];

  return <StandardSectionTabs defaultValue="channels" tabs={tabs} />;
}