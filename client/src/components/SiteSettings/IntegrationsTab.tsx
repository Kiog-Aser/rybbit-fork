"use client";

import { IS_CLOUD, REVENUE_ATTRIBUTION } from "@/lib/const";
import { GSCManager } from "./GSCManager";
import { StripeRevenueManager } from "./StripeRevenueManager";

interface IntegrationsTabProps {
  disabled?: boolean;
}

export function IntegrationsTab({ disabled = false }: IntegrationsTabProps) {
  return (
    <div className="space-y-6">
      {REVENUE_ATTRIBUTION && <StripeRevenueManager disabled={disabled} />}
      {IS_CLOUD && <GSCManager disabled={disabled} />}
    </div>
  );
}
