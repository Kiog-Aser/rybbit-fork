const CRAWLER_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /googlebot/i, label: "Google" },
  { pattern: /bingbot|bingpreview/i, label: "Bing" },
  { pattern: /duckduckbot/i, label: "DuckDuckGo" },
  { pattern: /yandex/i, label: "Yandex" },
  { pattern: /baiduspider/i, label: "Baidu" },
  { pattern: /chatgpt-user|chatgpt/i, label: "ChatGPT" },
  { pattern: /anthropic|claude/i, label: "Anthropic" },
  { pattern: /perplexity/i, label: "Perplexity" },
  { pattern: /gptbot|oai-searchbot/i, label: "OpenAI" },
  { pattern: /ccbot/i, label: "Common Crawl" },
  { pattern: /ahrefs/i, label: "Ahrefs" },
  { pattern: /semrush/i, label: "Semrush" },
  { pattern: /facebookexternalhit|meta-externalagent/i, label: "Meta" },
  { pattern: /twitterbot/i, label: "Twitter" },
  { pattern: /linkedinbot/i, label: "LinkedIn" },
  { pattern: /slackbot/i, label: "Slack" },
  { pattern: /applebot/i, label: "Apple" },
  { pattern: /bytespider/i, label: "ByteDance" },
  { pattern: /petalbot/i, label: "Huawei" },
  { pattern: /amazonbot/i, label: "Amazon" },
  { pattern: /headlesschrome/i, label: "Headless Chrome" },
];

const BRAND_STYLES: Record<string, { background: string; foreground: string; emoji: string }> = {
  Google: { background: "rgba(52, 168, 83, 0.18)", foreground: "#34a853", emoji: "G" },
  Bing: { background: "rgba(0, 137, 214, 0.18)", foreground: "#0089d6", emoji: "B" },
  DuckDuckGo: { background: "rgba(222, 88, 51, 0.18)", foreground: "#de5833", emoji: "D" },
  Anthropic: { background: "rgba(204, 120, 92, 0.2)", foreground: "#cc785c", emoji: "A" },
  ChatGPT: { background: "rgba(16, 163, 127, 0.18)", foreground: "#10a37f", emoji: "C" },
  OpenAI: { background: "rgba(16, 163, 127, 0.18)", foreground: "#10a37f", emoji: "O" },
  Perplexity: { background: "rgba(32, 128, 141, 0.18)", foreground: "#20808d", emoji: "P" },
  Apple: { background: "rgba(160, 160, 160, 0.18)", foreground: "#d4d4d4", emoji: "" },
  Amazon: { background: "rgba(255, 153, 0, 0.18)", foreground: "#ff9900", emoji: "a" },
};

const DEFAULT_BRAND = {
  background: "rgba(120, 120, 120, 0.14)",
  foreground: "inherit",
  emoji: "•",
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