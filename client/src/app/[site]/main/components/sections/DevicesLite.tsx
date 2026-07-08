"use client";

import { useExtracted } from "next-intl";
import {
  StandardSectionTabs,
  type StandardSectionTab,
} from "../../../components/shared/StandardSection/StandardSectionTabs";
import { Browser } from "../../../components/shared/icons/Browser";
import { DeviceIcon } from "../../../components/shared/icons/Device";
import { OperatingSystem } from "../../../components/shared/icons/OperatingSystem";

type Tab = "devices" | "browsers" | "os";

export function DevicesLite() {
  const t = useExtracted();

  const tabs: StandardSectionTab<Tab>[] = [
    {
      value: "browsers",
      label: t("Browsers"),
      section: {
        filterParameter: "browser",
        title: t("Browsers"),
        getValue: e => e.value,
        getKey: e => e.value,
        getLabel: e => (
          <div className="flex gap-2 items-center">
            <Browser browser={e.value} />
            {e.value || t("Other")}
          </div>
        ),
        lite: true,
      },
    },
    {
      value: "os",
      label: t("OS"),
      section: {
        filterParameter: "operating_system",
        title: t("Operating Systems"),
        getValue: e => e.value,
        getKey: e => e.value,
        getLabel: e => (
          <div className="flex gap-2 items-center">
            <OperatingSystem os={e.value || ""} />
            {e.value || t("Other")}
          </div>
        ),
        lite: true,
      },
    },
    {
      value: "devices",
      label: t("Devices"),
      section: {
        filterParameter: "device_type",
        title: t("Devices"),
        getValue: e => e.value,
        getKey: e => e.value,
        getLabel: e => (
          <div className="flex gap-2 items-center">
            <DeviceIcon deviceType={e.value || ""} size={16} />
            {e.value || t("Other")}
          </div>
        ),
        lite: true,
      },
    },
  ];

  return <StandardSectionTabs defaultValue="browsers" tabs={tabs} />;
}
