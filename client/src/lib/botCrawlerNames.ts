const CRAWLER_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /googlebot/i, label: "Google" },
  { pattern: /bingbot|bingpreview/i, label: "Bing" },
  { pattern: /duckduckbot/i, label: "DuckDuckGo" },
  { pattern: /yandex/i, label: "Yandex" },
  { pattern: /baiduspider/i, label: "Baidu" },
  { pattern: /chatgpt|openai/i, label: "ChatGPT" },
  { pattern: /anthropic|claude/i, label: "Anthropic" },
  { pattern: /perplexity/i, label: "Perplexity" },
  { pattern: /gptbot|oai-searchbot/i, label: "OpenAI Crawler" },
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
];

export function getCrawlerDisplayName(matchedPattern: string): string {
  if (!matchedPattern) return "Unknown crawler";
  for (const { pattern, label } of CRAWLER_LABELS) {
    if (pattern.test(matchedPattern)) return label;
  }
  const trimmed = matchedPattern.replace(/^\^|\$$/g, "").slice(0, 32);
  return trimmed || "Unknown crawler";
}