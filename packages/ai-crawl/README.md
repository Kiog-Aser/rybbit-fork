# @rybbit/ai-crawl

Server-side AI crawler tracking for Rybbit.

AI crawlers do **not** run JavaScript. The browser tracking script cannot see them.
This package runs in your Next.js middleware / edge / worker and reports crawler
hits to your Rybbit instance.

## Install

```bash
npm install @rybbit/ai-crawl
# or copy packages/ai-crawl into your monorepo and use "file:../path"
```

## Next.js middleware

```ts
import { trackAICrawlerRequest } from "@rybbit/ai-crawl";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

export function middleware(request: NextRequest, event: NextFetchEvent) {
  trackAICrawlerRequest(request, event, {
    siteId: "your_rybbit_site_id",
    // Defaults to https://analytics.milh.tech/api/ai-crawls for this fork.
    // apiUrl: "https://analytics.milh.tech/api/ai-crawls",
  });

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

Do **not** `await` `trackAICrawlerRequest` when you pass a Vercel/Cloudflare
context — it uses `waitUntil` so the page response is not delayed.

## Categories

| Category | Examples |
|----------|----------|
| `answer_fetch` | ChatGPT-User, Claude-User, Perplexity-User |
| `search_index` | Googlebot, OAI-SearchBot, PerplexityBot |
| `training` | GPTBot, ClaudeBot, Bytespider, CCBot |
| `ai_crawler` | Other AI bots |

These map to Rybbit dashboard tabs: **AI answers**, **Indexing**, **Training**.
