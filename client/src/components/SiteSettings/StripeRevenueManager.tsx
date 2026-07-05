"use client";

import {
  useConnectStripeRevenue,
  useDisconnectStripeRevenue,
  useStripeRevenueStatus,
  useSyncStripeRevenue,
} from "@/api/revenue/hooks";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { ExternalLink } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { BACKEND_URL } from "@/lib/const";
import { useStore } from "@/lib/store";

interface StripeRevenueManagerProps {
  disabled?: boolean;
}

export function StripeRevenueManager({ disabled = false }: StripeRevenueManagerProps) {
  const t = useExtracted();
  const { site } = useStore();
  const { data: status, isLoading, refetch } = useStripeRevenueStatus();
  const { mutate: connect, isPending: isConnecting } = useConnectStripeRevenue();
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnectStripeRevenue();
  const { mutate: syncRevenue, isPending: isSyncing } = useSyncStripeRevenue();
  const [restrictedKey, setRestrictedKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);

  const webhookUrl = site ? `${BACKEND_URL}/sites/${site}/revenue/stripe/webhook` : "";

  const handleConnect = () => {
    if (!restrictedKey.trim()) {
      toast.error(t("Paste your Stripe restricted key"));
      return;
    }

    connect(
      { restrictedKey: restrictedKey.trim(), webhookSecret: webhookSecret.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(
            t("Stripe connected — syncing the last 90 days of payments. Revenue may take a moment to appear.")
          );
          setRestrictedKey("");
          setWebhookSecret("");
          refetch();
        },
        onError: (error: Error) =>
          toast.error(error.message || t("Failed to connect Stripe")),
      }
    );
  };

  const handleDisconnect = async () => {
    return new Promise((resolve, reject) => {
      disconnect(undefined, {
        onSuccess: () => {
          toast.success(t("Stripe disconnected"));
          resolve(undefined);
        },
        onError: error => reject(error),
      });
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">{t("Stripe Revenue")}</h4>
        <p className="text-xs text-muted-foreground">{t("Loading...")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{t("Stripe Revenue")}</h4>
        <p className="text-xs text-muted-foreground">
          {t(
            "Create a restricted Stripe key with the preset permissions, paste it below, and revenue will attribute to your traffic sources."
          )}
        </p>
      </div>

      {status?.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-emerald-500">●</span>
            <span className="text-muted-foreground">{t("Connected")}</span>
          </div>
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">{t("Webhook URL")}</p>
            <code className="block text-xs break-all text-foreground">{webhookUrl}</code>
            <p className="text-xs text-muted-foreground">
              {t("Add this endpoint in Stripe and paste the signing secret below when reconnecting.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              disabled={disabled || isSyncing}
              onClick={() =>
                syncRevenue(undefined, {
                  onSuccess: data => {
                    const count = data?.imported ?? 0;
                    toast.success(
                      count > 0
                        ? `Synced ${count} payment${count === 1 ? "" : "s"} from Stripe`
                        : t("Stripe sync complete — no new payments in the last 90 days")
                    );
                    refetch();
                  },
                  onError: (error: Error) =>
                    toast.error(error.message || t("Failed to sync Stripe revenue")),
                })
              }
            >
              {isSyncing ? t("Syncing...") : t("Sync last 90 days")}
            </Button>
            <ConfirmationModal
              title={t("Disconnect Stripe?")}
              description={t("Revenue attribution will stop until you connect again.")}
              isOpen={isDisconnectModalOpen}
              setIsOpen={setIsDisconnectModalOpen}
              onConfirm={handleDisconnect}
              primaryAction={{ variant: "destructive", children: t("Disconnect") }}
            >
              <Button variant="outline" disabled={disabled || isDisconnecting}>
                {isDisconnecting ? t("Disconnecting...") : t("Disconnect")}
              </Button>
            </ConfirmationModal>
          </div>
          {status?.lastSyncAt && (
            <p className="text-xs text-muted-foreground">
              {t("Last synced")}: {new Date(status.lastSyncAt).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Button variant="outline" asChild>
            <a href={status?.restrictedKeyUrl} target="_blank" rel="noopener noreferrer">
              {t("Create Stripe key in Dashboard")}
              <ExternalLink className="w-3 h-3 ml-2" />
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("Stripe opens with the correct read permissions pre-selected. Copy the key and paste it here.")}
          </p>

          <div className="space-y-2">
            <Label htmlFor="stripe-restricted-key">{t("Restricted API key")}</Label>
            <Input
              id="stripe-restricted-key"
              type="password"
              placeholder="rk_live_..."
              value={restrictedKey}
              onChange={event => setRestrictedKey(event.target.value)}
              disabled={disabled || isConnecting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stripe-webhook-secret">{t("Webhook signing secret (optional)")}</Label>
            <Input
              id="stripe-webhook-secret"
              type="password"
              placeholder="whsec_..."
              value={webhookSecret}
              onChange={event => setWebhookSecret(event.target.value)}
              disabled={disabled || isConnecting}
            />
          </div>

          <Button onClick={handleConnect} disabled={disabled || isConnecting}>
            {isConnecting ? t("Connecting...") : t("Connect Stripe")}
          </Button>
        </div>
      )}
    </div>
  );
}