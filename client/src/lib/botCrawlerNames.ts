/**
 * Display names for AI crawlers.
 *
 * AI answers → product names (ChatGPT, Claude)
 * Indexing / training → company names (OpenAI, Anthropic) with logos
 */

export type CrawlerPurposeCategory = "ai_answers" | "indexing" | "training" | "all";

type CrawlerLogo = { type: "svg"; src: string } | { type: "favicon"; domain: string };

type BrandStyle = { background: string; foreground: string; logo: CrawlerLogo };

/** Order matters — more specific agent tokens first. */
const PRODUCT_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /chatgpt-user/i, label: "ChatGPT" },
  { pattern: /claude-user|claude-code/i, label: "Claude" },
  { pattern: /perplexity-user/i, label: "Perplexity" },
  { pattern: /google-agent|googleagent|google-notebooklm|google-read-aloud|copilot/i, label: "Google" },
  { pattern: /mistralai-user/i, label: "Mistral" },
  { pattern: /amzn-user/i, label: "Amazon" },
  { pattern: /kimi-user/i, label: "Kimi" },
  { pattern: /qwen-user/i, label: "Qwen" },
  { pattern: /xai-searchbot|grok-deepsearch/i, label: "Grok" },
  { pattern: /duckassistbot/i, label: "DuckDuckGo" },
  { pattern: /meta-externalfetcher/i, label: "Meta" },
];

const COMPANY_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /chatgpt|gptbot|oai-searchbot|oai-adsbot|openai/i, label: "OpenAI" },
  { pattern: /claude|anthropic/i, label: "Anthropic" },
  { pattern: /perplexity/i, label: "Perplexity" },
  { pattern: /googlebot|google-extended|googleother|google-agent|google-cloudvertex|google-notebooklm|google-inspection|googleagent|gemini/i, label: "Google" },
  { pattern: /bingbot|msnbot|copilot/i, label: "Microsoft" },
  { pattern: /duckduck|duckassist/i, label: "DuckDuckGo" },
  { pattern: /yandex/i, label: "Yandex" },
  { pattern: /baidu|ernie|yiyan/i, label: "Baidu" },
  { pattern: /ccbot|common.?crawl/i, label: "Common Crawl" },
  { pattern: /bytespider|doubao|tiktokspider/i, label: "ByteDance" },
  { pattern: /cohere/i, label: "Cohere" },
  { pattern: /grok|xai|x-ai/i, label: "xAI" },
  { pattern: /mistral/i, label: "Mistral" },
  { pattern: /amazon|amzn-/i, label: "Amazon" },
  { pattern: /applebot/i, label: "Apple" },
  { pattern: /meta-external|facebookbot/i, label: "Meta" },
  { pattern: /kimi|moonshot/i, label: "Moonshot" },
  { pattern: /qwen|tongyi|aliyun/i, label: "Alibaba" },
  { pattern: /deepseek/i, label: "DeepSeek" },
  { pattern: /chatglm|zhipu/i, label: "Zhipu AI" },
  { pattern: /ai2bot|allen/i, label: "Allen AI" },
  { pattern: /youbot|you\.com/i, label: "You.com" },
  { pattern: /ahrefs/i, label: "Ahrefs" },
  { pattern: /semrush/i, label: "Semrush" },
  { pattern: /twitterbot/i, label: "Twitter" },
  { pattern: /linkedinbot/i, label: "LinkedIn" },
  { pattern: /slackbot/i, label: "Slack" },
  { pattern: /petalbot/i, label: "Huawei" },
  { pattern: /diffbot/i, label: "Diffbot" },
  { pattern: /headlesschrome/i, label: "Headless Chrome" },
];

const BRAND_STYLES: Record<string, BrandStyle> = {
  Google: { background: "rgba(52, 168, 83, 0.18)", foreground: "#34a853", logo: { type: "svg", src: "/crawlers/Google.svg" } },
  Bing: { background: "rgba(0, 137, 214, 0.18)", foreground: "#0089d6", logo: { type: "svg", src: "/crawlers/Bing.svg" } },
  Microsoft: { background: "rgba(0, 137, 214, 0.18)", foreground: "#0089d6", logo: { type: "svg", src: "/crawlers/Bing.svg" } },
  DuckDuckGo: { background: "rgba(222, 88, 51, 0.18)", foreground: "#de5833", logo: { type: "svg", src: "/crawlers/DuckDuckGo.svg" } },
  Yandex: { background: "rgba(255, 0, 0, 0.12)", foreground: "#ff0000", logo: { type: "svg", src: "/crawlers/Yandex.svg" } },
  Baidu: { background: "rgba(37, 99, 235, 0.14)", foreground: "#2563eb", logo: { type: "svg", src: "/crawlers/Baidu.svg" } },
  Apple: { background: "rgba(160, 160, 160, 0.18)", foreground: "#d4d4d4", logo: { type: "svg", src: "/crawlers/Apple.svg" } },
  Twitter: { background: "rgba(29, 155, 240, 0.14)", foreground: "#1d9bf0", logo: { type: "svg", src: "/crawlers/Twitter.svg" } },
  Ahrefs: { background: "rgba(255, 119, 0, 0.14)", foreground: "#ff7700", logo: { type: "svg", src: "/crawlers/Ahrefs.svg" } },
  // Anthropic company + Claude product share the same brand colors/logo
  Anthropic: { background: "rgba(204, 120, 92, 0.2)", foreground: "#cc785c", logo: { type: "favicon", domain: "claude.ai" } },
  Claude: { background: "rgba(204, 120, 92, 0.2)", foreground: "#cc785c", logo: { type: "favicon", domain: "claude.ai" } },
  ChatGPT: { background: "rgba(16, 163, 127, 0.18)", foreground: "#10a37f", logo: { type: "favicon", domain: "openai.com" } },
  OpenAI: { background: "rgba(16, 163, 127, 0.18)", foreground: "#10a37f", logo: { type: "favicon", domain: "openai.com" } },
  Perplexity: { background: "rgba(32, 128, 141, 0.18)", foreground: "#20808d", logo: { type: "favicon", domain: "perplexity.ai" } },
  Amazon: { background: "rgba(255, 153, 0, 0.18)", foreground: "#ff9900", logo: { type: "favicon", domain: "amazon.com" } },
  "Common Crawl": { background: "rgba(99, 102, 241, 0.16)", foreground: "#818cf8", logo: { type: "favicon", domain: "commoncrawl.org" } },
  ByteDance: { background: "rgba(0, 0, 0, 0.2)", foreground: "#f5f5f5", logo: { type: "favicon", domain: "bytedance.com" } },
  Cohere: { background: "rgba(139, 92, 246, 0.16)", foreground: "#a78bfa", logo: { type: "favicon", domain: "cohere.com" } },
  xAI: { background: "rgba(120, 120, 120, 0.16)", foreground: "#e5e5e5", logo: { type: "favicon", domain: "x.ai" } },
  Grok: { background: "rgba(120, 120, 120, 0.16)", foreground: "#e5e5e5", logo: { type: "favicon", domain: "x.ai" } },
  Mistral: { background: "#ff700014", foreground: "#ff7000", logo: { type: "favicon", domain: "mistral.ai" } },
  Meta: { background: "rgba(24, 119, 242, 0.16)", foreground: "#1877f2", logo: { type: "favicon", domain: "meta.com" } },
  Semrush: { background: "rgba(255, 100, 46, 0.14)", foreground: "#ff642e", logo: { type: "favicon", domain: "semrush.com" } },
  LinkedIn: { background: "rgba(10, 102, 194, 0.14)", foreground: "#0a66c2", logo: { type: "favicon", domain: "linkedin.com" } },
  Slack: { background: "rgba(74, 21, 75, 0.14)", foreground: "#4a154b", logo: { type: "favicon", domain: "slack.com" } },
  Huawei: { background: "rgba(207, 0, 15, 0.12)", foreground: "#cf000f", logo: { type: "favicon", domain: "huawei.com" } },
  Diffbot: { background: "rgba(59, 130, 246, 0.14)", foreground: "#3b82f6", logo: { type: "favicon", domain: "diffbot.com" } },
  Moonshot: { background: "rgba(99, 102, 241, 0.16)", foreground: "#818cf8", logo: { type: "favicon", domain: "moonshot.cn" } },
  Kimi: { background: "rgba(99, 102, 241, 0.16)", foreground: "#818cf8", logo: { type: "favicon", domain: "kimi.moonshot.cn" } },
  Alibaba: { background: "rgba(255, 106, 0, 0.14)", foreground: "#ff6a00", logo: { type: "favicon", domain: "alibaba.com" } },
  Qwen: { background: "rgba(255, 106, 0, 0.14)", foreground: "#ff6a00", logo: { type: "favicon", domain: "tongyi.aliyun.com" } },
  DeepSeek: { background: "rgba(59, 130, 246, 0.14)", foreground: "#3b82f6", logo: { type: "favicon", domain: "deepseek.com" } },
  "Zhipu AI": { background: "rgba(59, 130, 246, 0.14)", foreground: "#3b82f6", logo: { type: "favicon", domain: "zhipuai.cn" } },
  "Allen AI": { background: "rgba(16, 185, 129, 0.14)", foreground: "#10b981", logo: { type: "favicon", domain: "allenai.org" } },
  "You.com": { background: "rgba(99, 102, 241, 0.16)", foreground: "#818cf8", logo: { type: "favicon", domain: "you.com" } },
};

const DEFAULT_BRAND: BrandStyle = {
  background: "rgba(120, 120, 120, 0.14)",
  foreground: "inherit",
  logo: { type: "favicon", domain: "example.com" },
};

/** Strip purpose prefix from middleware patterns: "answer_fetch:chatgpt-user" → "chatgpt-user" */
export function stripCrawlerPurposePrefix(matchedPattern: string): string {
  if (!matchedPattern) return "";
  const colon = matchedPattern.indexOf(":");
  if (colon > 0 && /^(answer_fetch|search_index|training|ai_crawler)$/i.test(matchedPattern.slice(0, colon))) {
    return matchedPattern.slice(colon + 1);
  }
  return matchedPattern;
}

function matchLabel(agent: string, rules: Array<{ pattern: RegExp; label: string }>): string | null {
  for (const { pattern, label } of rules) {
    if (pattern.test(agent)) return label;
  }
  return null;
}

/**
 * @param matchedPattern raw matched_ua_pattern from bot_events
 * @param category dashboard tab — AI answers use product names; indexing/training use companies
 */
export function getCrawlerDisplayName(
  matchedPattern: string,
  category: CrawlerPurposeCategory = "all"
): string {
  if (!matchedPattern) return "Unknown crawler";

  const agent = stripCrawlerPurposePrefix(matchedPattern);
  const full = matchedPattern;

  if (category === "ai_answers") {
    const product = matchLabel(agent, PRODUCT_LABELS) || matchLabel(full, PRODUCT_LABELS);
    if (product) return product;
    // Fall back: map company → product for known answer agents
    const company = matchLabel(agent, COMPANY_LABELS) || matchLabel(full, COMPANY_LABELS);
    if (company === "OpenAI") return "ChatGPT";
    if (company === "Anthropic") return "Claude";
    if (company) return company;
  } else {
    const company = matchLabel(agent, COMPANY_LABELS) || matchLabel(full, COMPANY_LABELS);
    if (company) return company;
    // If only product pattern matched (e.g. claude-user in training bucket), promote to company
    const product = matchLabel(agent, PRODUCT_LABELS) || matchLabel(full, PRODUCT_LABELS);
    if (product === "ChatGPT") return "OpenAI";
    if (product === "Claude") return "Anthropic";
    if (product === "Grok") return "xAI";
    if (product) return product;
  }

  if (/[\^$()?*+|\\]/.test(agent)) return "Other bot";
  const trimmed = agent.replace(/^\^|\$$/g, "").slice(0, 32);
  return trimmed || "Other bot";
}

export function getCrawlerBrandStyle(label: string): BrandStyle {
  return BRAND_STYLES[label] ?? DEFAULT_BRAND;
}

export function getCrawlerLogo(label: string): CrawlerLogo {
  return getCrawlerBrandStyle(label).logo;
}

/** Aggregate rows that share a display label (e.g. multiple OpenAI UA patterns). */
export function aggregateCrawlerRows(
  items: { value: string; count: number }[],
  category: CrawlerPurposeCategory = "all"
): { label: string; count: number; values: string[] }[] {
  const map = new Map<string, { label: string; count: number; values: string[] }>();
  for (const item of items) {
    if (!item.value) continue;
    const label = getCrawlerDisplayName(item.value, category);
    const existing = map.get(label);
    if (existing) {
      existing.count += item.count;
      existing.values.push(item.value);
    } else {
      map.set(label, { label, count: item.count, values: [item.value] });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
