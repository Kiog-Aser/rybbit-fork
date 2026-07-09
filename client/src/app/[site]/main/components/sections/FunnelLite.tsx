"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useGetFunnel } from "../../../../../api/analytics/hooks/funnels/useGetFunnel";
import { useGetFunnels } from "../../../../../api/analytics/hooks/funnels/useGetFunnels";
import { Card, CardContent, CardLoader } from "../../../../../components/ui/card";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { useStore } from "../../../../../lib/store";
import { FunnelGradientChart } from "../../../funnels/components/FunnelGradientChart";

export function FunnelLite() {
  const t = useExtracted();
  const { site } = useParams();
  const { site: siteId } = useStore();
  const { data: funnels, isLoading: funnelsLoading } = useGetFunnels(siteId);
  const primaryFunnel = funnels?.[0];

  const { data: funnelData, isLoading: dataLoading, isFetching } = useGetFunnel(
    primaryFunnel ? { steps: primaryFunnel.steps } : undefined,
    !!primaryFunnel
  );

  const isLoading = funnelsLoading || dataLoading;

  return (
    <Card className="overflow-visible">
      {isFetching && <CardLoader />}
      <CardContent className="p-4 overflow-visible">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">{primaryFunnel?.name ?? t("Funnel")}</h3>
            {primaryFunnel && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {primaryFunnel.steps.length} {t("steps")}
              </p>
            )}
          </div>
          <Link
            href={`/${site}/funnels`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("Manage")}
          </Link>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : !primaryFunnel ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            <Link href={`/${site}/funnels`} className="underline hover:no-underline">
              {t("Create a funnel")}
            </Link>{" "}
            {t("to track conversions")}
          </p>
        ) : funnelData && funnelData.length > 0 ? (
          <FunnelGradientChart data={funnelData} />
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">{t("No funnel data in this period")}</p>
        )}
      </CardContent>
    </Card>
  );
}