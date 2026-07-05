"use client";

import NumberFlow from "@number-flow/react";
import { DollarSign } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRevenueOverview } from "@/api/revenue/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSetPageTitle } from "@/hooks/useSetPageTitle";
import { REVENUE_ATTRIBUTION } from "@/lib/const";
import { useStore } from "@/lib/store";
import { SubHeader } from "../components/SubHeader/SubHeader";

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function RevenuePage() {
  const t = useExtracted();
  const { site } = useStore();
  const { data, isLoading } = useRevenueOverview();

  useSetPageTitle(t("Revenue"));

  if (!REVENUE_ATTRIBUTION) {
    return null;
  }

  if (!site) {
    return null;
  }

  const totals = data?.totals;
  const byChannel = data?.byChannel ?? [];

  return (
    <div className="p-2 md:p-4 max-w-[1100px] mx-auto space-y-3">
      <SubHeader />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Total revenue")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {isLoading ? "…" : <NumberFlow value={(totals?.revenue_cents ?? 0) / 100} format={{ style: "currency", currency: "USD" }} />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Payments")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {isLoading ? "…" : <NumberFlow value={totals?.payment_count ?? 0} />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Paying users")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {isLoading ? "…" : <NumberFlow value={totals?.paying_users ?? 0} />}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            {t("Revenue by channel")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("Loading...")}</p>
          ) : byChannel.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("No revenue yet. Connect Stripe in Site Settings → Integrations and pass rybbit_session_id in checkout metadata.")}
            </p>
          ) : (
            <div className="space-y-2">
              {byChannel.map(row => (
                <div
                  key={row.channel}
                  className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2"
                >
                  <span className="text-sm font-medium capitalize">{row.channel}</span>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{formatMoney(row.revenue_cents)}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.payment_count} {t("payments")} · {row.visitors} {t("users")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}