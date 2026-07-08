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
  "Common Crawl": { background: "rgba(99, 102, 241, 0.16)", foreground: "#818cf8", emoji: "C" },
  ByteDance: { background: "rgba(0, 0, 0, 0.2)", foreground: "#f5f5f5", emoji: "B" },
  Cohere: { background: "rgba(139, 92, 246, 0.16)", foreground: "#a78bfa", emoji: "Co" },
  xAI: { background: "rgba(120, 120, 120, 0.16)", foreground: "#e5e5e5", emoji: "X" },
  Mistral: { background: "#ff700014", foreground: "#ff7000", emoji: "M" },
  Meta: { background: "rgba(24, 119, 242, 0.16)", foreground: "#1877f2", emoji: "f" },
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