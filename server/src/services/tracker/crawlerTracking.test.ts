import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { shouldRecordCrawlerRequest } from "./crawlerTracking.js";

function makeRequest(overrides: Partial<FastifyRequest> & { url: string }): FastifyRequest {
  return {
    method: "GET",
    hostname: "example.com",
    headers: {},
    ...overrides,
  } as FastifyRequest;
}

describe("shouldRecordCrawlerRequest", () => {
  it("ignores API routes", () => {
    expect(
      shouldRecordCrawlerRequest(
        makeRequest({
          url: "/api/health",
          headers: { "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.0)" },
        })
      )
    ).toBe(false);
  });

  it("detects AI crawlers on document paths", () => {
    expect(
      shouldRecordCrawlerRequest(
        makeRequest({
          url: "/pricing",
          headers: { "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.0)" },
        })
      )
    ).toBe(true);
  });

  it("ignores normal browsers", () => {
    expect(
      shouldRecordCrawlerRequest(
        makeRequest({
          url: "/pricing",
          headers: {
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        })
      )
    ).toBe(false);
  });
});
