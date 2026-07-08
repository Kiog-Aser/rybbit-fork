"use client";
import { ReactNode } from "react";
import { useGetLiveUserCount } from "../../../api/analytics/hooks/useGetLiveUserCount";
import { useInView } from "../../../hooks/useInView";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { IS_CLOUD, LITE_DASHBOARD } from "../../../lib/const";
import { useStore } from "../../../lib/store";
import { SubHeader } from "../components/SubHeader/SubHeader";
import { MainSection } from "./components/MainSection/MainSection";
import { MainSectionLite } from "./components/MainSection/MainSectionLite";
import { Countries } from "./components/sections/Countries";
import { CountriesLite } from "./components/sections/CountriesLite";
import { CrawlersLite } from "./components/sections/CrawlersLite";
import { Devices } from "./components/sections/Devices";
import { DevicesLite } from "./components/sections/DevicesLite";
import { Events } from "./components/sections/Events";
import { FunnelLite } from "./components/sections/FunnelLite";
import { Pages } from "./components/sections/Pages";
import { PagesLite } from "./components/sections/PagesLite";
import { Referrers } from "./components/sections/Referrers";
import { ReferrersLite } from "./components/sections/ReferrersLite";
import { SearchConsole } from "./components/sections/SearchConsole";
import { UsersLite } from "./components/sections/UsersLite";
import { Weekdays } from "./components/sections/Weekdays";

function LazySection({ children, height = "405px" }: { children: ReactNode; height?: string }) {
  const { ref, isInView } = useInView({ persistVisibility: true, rootMargin: "100px 0px" });
  return (
    <div ref={ref} style={{ minHeight: isInView ? undefined : height }}>
      {isInView ? children : null}
    </div>
  );
}

export default function MainPage() {
  const { site } = useStore();

  if (!site) {
    return null;
  }

  return <MainPageContent />;
}

function MainPageContent() {
  const { data } = useGetLiveUserCount(5);

  useSetPageTitle(`${data?.count ?? "…"} user${data?.count === 1 ? "" : "s"} online`);

  if (LITE_DASHBOARD) {
    return (
      <div className="p-2 md:p-4 max-w-[1100px] mx-auto space-y-3">
        <SubHeader />
        <MainSectionLite />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          <LazySection>
            <ReferrersLite />
          </LazySection>
          <LazySection>
            <PagesLite />
          </LazySection>
          <LazySection>
            <CountriesLite />
          </LazySection>
          <LazySection>
            <DevicesLite />
          </LazySection>
        </div>
        <LazySection height="360px">
          <UsersLite />
        </LazySection>
        <LazySection height="280px">
          <FunnelLite />
        </LazySection>
        <LazySection height="320px">
          <CrawlersLite />
        </LazySection>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-4 max-w-[1100px] mx-auto space-y-3">
      <SubHeader />
      <MainSection />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <LazySection>
          <Referrers />
        </LazySection>
        <LazySection>
          <Pages />
        </LazySection>
        <LazySection>
          <Devices />
        </LazySection>
        <LazySection>
          <Countries />
        </LazySection>
        <LazySection height="394px">
          <Events />
        </LazySection>
        <LazySection>
          <Weekdays />
        </LazySection>
        {IS_CLOUD && (
          <LazySection>
            <SearchConsole />
          </LazySection>
        )}
      </div>
    </div>
  );
}
