const CRAWLER_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /chatgpt-user/i, label: "ChatGPT" },
  { pattern: /gptbot|oai-searchbot|openai/i, label: "OpenAI" },
  { pattern: /claudebot|claude-user|claude-searchbot|claude-code|anthropic/i, label: "Anthropic" },
  { pattern: /perplexitybot|perplexity-user|perplexity/i, label: "Perplexity" },
  { pattern: /googlebot|google-extended|googleother|google-inspectiontool/i, label: "Google" },
  { pattern: /bingbot|bingpreview/i, label: "Bing" },
  { pattern: /duckduckbot|duckduckgo/i, label: "DuckDuckGo" },
  { pattern: /yandexbot|yandex/i, label: "Yandex" },
  { pattern: /baiduspider/i, label: "Baidu" },
  { pattern: /ccbot/i, label: "Common Crawl" },
  { pattern: /bytespider/i, label: "ByteDance" },
  { pattern: /cohere-ai/i, label: "Cohere" },
  { pattern: /grokbot/i, label: "xAI" },
  { pattern: /mistralai/i, label: "Mistral" },
  { pattern: /amazonbot/i, label: "Amazon" },
  { pattern: /applebot-extended|applebot/i, label: "Apple" },
  { pattern: /meta-external|facebookexternalhit|facebot/i, label: "Meta" },
  { pattern: /ahrefs/i, label: "Ahrefs" },
  { pattern: /semrush/i, label: "Semrush" },
  { pattern: /twitterbot/i, label: "Twitter" },
  { pattern: /linkedinbot/i, label: "LinkedIn" },
  { pattern: /slackbot/i, label: "Slack" },
  { pattern: /petalbot/i, label: "Huawei" },
  { pattern: /diffbot/i, label: "Diffbot" },
  { pattern: /headlesschrome/i, label: "Headless Chrome" },
];

type CrawlerLogo =
  | { type: "svg"; src: string }
  | { type: "favicon"; domain: string };

const BRAND_STYLES: Record<string, { background: string; foreground: string; logo: CrawlerLogo }> = {
  Google: { background: "rgba(52, 168, 83, 0.18)", foreground: "#34a853", logo: { type: "svg", src: "/crawlers/Google.svg" } },
  Bing: { background: "rgba(0, 137, 214, 0.18)", foreground: "#0089d6", logo: { type: "svg", src: "/crawlers/Bing.svg" } },
  DuckDuckGo: { background: "rgba(222, 88, 51, 0.18)", foreground: "#de5833", logo: { type: "svg", src: "/crawlers/DuckDuckGo.svg" } },
  Yandex: { background: "rgba(255, 0, 0, 0.12)", foreground: "#ff0000", logo: { type: "svg", src: "/crawlers/Yandex.svg" } },
  Baidu: { background: "rgba(37, 99, 235, 0.14)", foreground: "#2563eb", logo: { type: "svg", src: "/crawlers/Baidu.svg" } },
  Apple: { background: "rgba(160, 160, 160, 0.18)", foreground: "#d4d4d4", logo: { type: "svg", src: "/crawlers/Apple.svg" } },
  Twitter: { background: "rgba(29, 155, 240, 0.14)", foreground: "#1d9bf0", logo: { type: "svg", src: "/crawlers/Twitter.svg" } },
  Ahrefs: { background: "rgba(255, 119, 0, 0.14)", foreground: "#ff7700", logo: { type: "svg", src: "/crawlers/Ahrefs.svg" } },
  Anthropic: { background: "rgba(204, 120, 92, 0.2)", foreground: "#cc785c", logo: { type: "favicon", domain: "anthropic.com" } },
  ChatGPT: { background: "rgba(16, 163, 127, 0.18)", foreground: "#10a37f", logo: { type: "favicon", domain: "openai.com" } },
  OpenAI: { background: "rgba(16, 163, 127, 0.18)", foreground: "#10a37f", logo: { type: "favicon", domain: "openai.com" } },
  Perplexity: { background: "rgba(32, 128, 141, 0.18)", foreground: "#20808d", logo: { type: "favicon", domain: "perplexity.ai" } },
  Amazon: { background: "rgba(255, 153, 0, 0.18)", foreground: "#ff9900", logo: { type: "favicon", domain: "amazon.com" } },
  "Common Crawl": { background: "rgba(99, 102, 241, 0.16)", foreground: "#818cf8", logo: { type: "favicon", domain: "commoncrawl.org" } },
  ByteDance: { background: "rgba(0, 0, 0, 0.2)", foreground: "#f5f5f5", logo: { type: "favicon", domain: "bytedance.com" } },
  Cohere: { background: "rgba(139, 92, 246, 0.16)", foreground: "#a78bfa", logo: { type: "favicon", domain: "cohere.com" } },
  xAI: { background: "rgba(120, 120, 120, 0.16)", foreground: "#e5e5e5", logo: { type: "favicon", domain: "x.ai" } },
  Mistral: { background: "#ff700014", foreground: "#ff7000", logo: { type: "favicon", domain: "mistral.ai" } },
  Meta: { background: "rgba(24, 119, 242, 0.16)", foreground: "#1877f2", logo: { type: "favicon", domain: "meta.com" } },
  Semrush: { background: "rgba(255, 100, 46, 0.14)", foreground: "#ff642e", logo: { type: "favicon", domain: "semrush.com" } },
  LinkedIn: { background: "rgba(10, 102, 194, 0.14)", foreground: "#0a66c2", logo: { type: "favicon", domain: "linkedin.com" } },
  Slack: { background: "rgba(74, 21, 75, 0.14)", foreground: "#4a154b", logo: { type: "favicon", domain: "slack.com" } },
  Huawei: { background: "rgba(207, 0, 15, 0.12)", foreground: "#cf000f", logo: { type: "favicon", domain: "huawei.com" } },
  Diffbot: { background: "rgba(59, 130, 246, 0.14)", foreground: "#3b82f6", logo: { type: "favicon", domain: "diffbot.com" } },
};

const DEFAULT_BRAND = {
  background: "rgba(120, 120, 120, 0.14)",
  foreground: "inherit",
  logo: { type: "favicon", domain: "example.com" } as CrawlerLogo,
};

export function getCrawlerDisplayName(matchedPattern: string): string {
  if (!matchedPattern) return "Unknown crawler";
  for (const { pattern, label } of CRAWLER_LABELS) {
    if (pattern.test(matchedPattern)) return label;
  }
  if (/[\^$()?*+|\\]/.test(matchedPattern)) {
    return "Other bot";
  }
  const trimmed = matchedPattern.replace(/^\^|\$$/g, "").slice(0, 32);
  return trimmed || "Other bot";
}

export function getCrawlerBrandStyle(label: string) {
  return BRAND_STYLES[label] ?? DEFAULT_BRAND;
}

export function getCrawlerLogo(label: string): CrawlerLogo {
  return getCrawlerBrandStyle(label).logo;
}