"use client";

import { useExtracted } from "next-intl";
import { Favicon } from "../../../../../components/Favicon";
import { ChannelDonut } from "./ChannelDonut";
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
      content: <ChannelDonut />,
      dialogContent: <ChannelDonut />,
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
