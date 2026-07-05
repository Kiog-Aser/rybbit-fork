"use client";
import { Card, CardContent, CardLoader } from "@/components/ui/card";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { useGetOverviewBucketed } from "../../../../../api/analytics/hooks/useGetOverviewBucketed";
import { BucketSelection } from "../../../../../components/BucketSelection";
import { RybbitTextLogo } from "../../../../../components/RybbitLogo";
import { useWhiteLabel } from "../../../../../hooks/useIsWhiteLabel";
import { authClient } from "../../../../../lib/auth";
import { useStore } from "../../../../../lib/store";
import { useRevenueTimeSeries } from "../../../../../api/revenue/hooks";
import { REVENUE_ATTRIBUTION } from "../../../../../lib/const";
import { Chart } from "./Chart";
import { OverviewLite } from "./OverviewLite";

// Lite variant of MainSection: drops the 2 previous-period queries and reads
// MV-backed endpoints. Halves the query count for the top of the dashboard.
export function MainSectionLite() {
  const { isWhiteLabel } = useWhiteLabel();
  const session = authClient.useSession();
  const t = useExtracted();

  const { selectedStat, site, bucket } = useStore();

  const getSelectedStatLabel = () => {
    switch (selectedStat) {
      case "users": return t("Visitors");
      case "bounce_rate": return t("Bounce rate");
      case "session_duration": return t("Session time");
      case "pageviews": return t("Pageviews");
      case "sessions": return t("Sessions");
      case "pages_per_session": return t("Pages per Session");
      default: return selectedStat;
    }
  };

  const { data, isFetching } = useGetOverviewBucketed({ site, bucket, lite: true });
  const { data: revenueSeries } = useRevenueTimeSeries();

  const max = Math.max(...(data?.data?.map((d: any) => d[selectedStat]) ?? []));

  return (
    <>
      <Card>
        <CardContent className="p-0 w-full">
          <OverviewLite />
        </CardContent>
      </Card>
      <Card>
        {isFetching && <CardLoader />}
        <CardContent className="p-2 md:p-4 py-3 w-full">
          <div className="flex items-center justify-between px-2 md:px-0">
            <div className="flex items-center space-x-4">
              {!isWhiteLabel && (
                <Link href={session.data ? "/" : "https://rybbit.com"} className="opacity-75">
                  <RybbitTextLogo width={80} height={0} />
                </Link>
              )}
            </div>
            <span className="text-sm text-neutral-700 dark:text-neutral-200">{getSelectedStatLabel()}</span>
            <BucketSelection />
          </div>
          <div className="h-[200px] md:h-[290px] relative">
            <Chart
              data={data}
              max={max}
              previousData={undefined}
              chartXMax={undefined}
              revenueTimeSeries={REVENUE_ATTRIBUTION ? revenueSeries : undefined}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
