"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useExtracted } from "next-intl";
import { toast } from "@/components/ui/sonner";

import { FORK_REPO, IS_CLOUD, IS_FORK_SELF_HOST } from "../lib/const";
import packageJson from "../../package.json";
import { X } from "lucide-react";
import { Button } from "./ui/button";

const VERSION_CHECK_DONE_KEY = "version-check-done";

export function VersionCheck() {
  const t = useExtracted();

  const [shouldCheckVersion] = useState(() => {
    if (IS_CLOUD || typeof window === "undefined") return false;
    return !sessionStorage.getItem(VERSION_CHECK_DONE_KEY);
  });

  const { data: latestVersion } = useQuery({
    queryKey: ["version-check", FORK_REPO ?? "upstream"],
    queryFn: () => fetchLatestVersion(FORK_REPO),
    enabled: shouldCheckVersion,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const upgradeHref = useMemo(() => {
    if (IS_FORK_SELF_HOST && FORK_REPO) {
      return `https://github.com/${FORK_REPO}/blob/master/README-AKASH.md#updating-safely`;
    }
    return "https://rybbit.com/docs/managing-your-installation#updating-your-installation";
  }, []);

  useEffect(() => {
    if (!shouldCheckVersion || !latestVersion) return;

    const current = packageJson.version;

    if (latestVersion !== current && isNewer(latestVersion, current)) {
      toast.custom(
        toastInstance => (
          <div
            style={{
              opacity: toastInstance.visible ? 1 : 0,
              transform: toastInstance.visible ? "translateY(0)" : "translateY(-8px)",
              transition: "opacity 200ms ease, transform 200ms ease",
            }}
            className="flex items-center gap-3 bg-white dark:bg-neutral-850 border border-neutral-150 dark:border-neutral-850 rounded-lg shadow-lg py-2 px-3 text-sm"
          >
            <span>{t("Rybbit v{latest} is available (you're on v{current})", { latest: latestVersion, current })}</span>
            <a href={upgradeHref} target="_blank" rel="noopener noreferrer">
              <Button variant="success" size="sm">
                {t("Upgrade")}
              </Button>
            </a>
            <button
              onClick={() => toast.dismiss(toastInstance.id)}
              className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              <X size={16} />
            </button>
          </div>
        ),
        { duration: 10000 }
      );
    }
  }, [latestVersion, shouldCheckVersion, t, upgradeHref]);

  return null;
}

async function fetchLatestVersion(forkRepo: string | undefined): Promise<string | null> {
  if (typeof window === "undefined") return null;

  sessionStorage.setItem(VERSION_CHECK_DONE_KEY, "1");

  // Fork self-hosts must not compare against Rybbit Cloud — that version is unrelated.
  if (forkRepo) {
    try {
      const res = await fetch(`https://api.github.com/repos/${forkRepo}/releases/latest`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (res.status === 404) return null;
      if (!res.ok) return null;

      const data = (await res.json()) as { tag_name?: string };
      const tag = data.tag_name?.replace(/^v/, "");
      return tag ?? null;
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch("https://app.rybbit.io/api/version");
    if (!res.ok) return null;

    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

function isNewer(latest: string, current: string): boolean {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}
