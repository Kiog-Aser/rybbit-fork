import { describe, expect, it } from "vitest";
import { filterRowsByAllowedDateRange } from "./rybbitExportInstantImport.js";

describe("filterRowsByAllowedDateRange", () => {
  it("keeps rows inside the allowed window", () => {
    const { allowed, skipped } = filterRowsByAllowedDateRange(
      [
        {
          time: "2026-06-10 00:00:00",
          sessions: 5,
          pages_per_session: 2,
          bounce_rate: 40,
          session_duration: 60,
          pageviews: 10,
          users: 4,
        },
        {
          time: "2020-01-01 00:00:00",
          sessions: 1,
          pages_per_session: 1,
          bounce_rate: 0,
          session_duration: 0,
          pageviews: 1,
          users: 1,
        },
      ],
      "2026-06-01",
      "2026-07-05"
    );

    expect(skipped).toBe(1);
    expect(allowed).toHaveLength(1);
    expect(allowed[0]?.time).toBe("2026-06-10 00:00:00");
  });
});