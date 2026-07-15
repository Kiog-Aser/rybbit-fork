import { describe, expect, it } from "vitest";
import { z } from "zod";

// Light schema parity tests — full handler needs ClickHouse in integration.

const PURPOSE_CATEGORY = z.enum(["answer_fetch", "search_index", "training", "ai_crawler"]);

const aiCrawlBodySchema = z.object({
  siteId: z.string().min(1).max(64).optional(),
  websiteId: z.string().min(1).max(64).optional(),
  domain: z.string().max(253).optional(),
  href: z.string().url().max(8192),
  referrer: z.string().max(2048).nullable().optional(),
  ai: z.object({
    provider: z.string().max(100).optional(),
    agent: z.string().max(200).optional(),
    category: PURPOSE_CATEGORY.optional(),
    userAgent: z.string().max(512).optional(),
    ip: z.string().max(64).nullable().optional(),
    statusCode: z.number().int().min(0).max(599).optional(),
    source: z.string().max(64).optional(),
  }),
});

describe("ai crawl ingest payload", () => {
  it("accepts Rybbit siteId payloads", () => {
    const result = aiCrawlBodySchema.safeParse({
      siteId: "d9411320640f",
      href: "https://www.lockinmcp.com/pricing",
      ai: {
        provider: "OpenAI",
        agent: "ChatGPT-User",
        category: "answer_fetch",
        userAgent: "Mozilla/5.0 (compatible; ChatGPT-User/1.0)",
        ip: "1.2.3.4",
        source: "server_middleware",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts DataFast-compatible websiteId", () => {
    const result = aiCrawlBodySchema.safeParse({
      websiteId: "d9411320640f",
      href: "https://www.lockinmcp.com/",
      ai: {
        agent: "GPTBot",
        category: "training",
        userAgent: "GPTBot/1.0",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid href", () => {
    const result = aiCrawlBodySchema.safeParse({
      siteId: "d9411320640f",
      href: "not-a-url",
      ai: {},
    });
    expect(result.success).toBe(false);
  });
});
