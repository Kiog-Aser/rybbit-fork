"use client";

import Image from "next/image";
import { Favicon } from "./Favicon";
import { getCrawlerLogo } from "../lib/botCrawlerNames";
import { cn } from "../lib/utils";

type CrawlerLogoProps = {
  label: string;
  size?: number;
  className?: string;
};

export function CrawlerLogo({ label, size = 16, className }: CrawlerLogoProps) {
  const logo = getCrawlerLogo(label);
  const dimensionClass = size === 16 ? "w-4 h-4" : size === 20 ? "w-5 h-5" : "w-4 h-4";

  if (logo.type === "svg") {
    return (
      <Image
        src={logo.src}
        alt={label}
        width={size}
        height={size}
        className={cn("shrink-0", dimensionClass, className)}
        unoptimized
      />
    );
  }

  return <Favicon domain={logo.domain} className={cn("shrink-0", dimensionClass, className)} />;
}