export declare const AI_CRAWLER_CATEGORY: {
  readonly ANSWER_FETCH: "answer_fetch";
  readonly SEARCH_INDEX: "search_index";
  readonly TRAINING: "training";
  readonly AI_CRAWLER: "ai_crawler";
};
export type AICrawlerCategory = (typeof AI_CRAWLER_CATEGORY)[keyof typeof AI_CRAWLER_CATEGORY];
export interface AICrawlerMatch {
  provider: string;
  agent: string;
  category: AICrawlerCategory;
}
export type RybbitAICrawlerSkipReason =
  | "disabled"
  | "missing_site_id"
  | "method_not_tracked"
  | "not_ai_crawler"
  | "category_skipped"
  | "search_crawler_skipped"
  | "invalid_url"
  | "url_too_long"
  | "static_fetch_destination"
  | "ignored_path_prefix"
  | "ignored_file_extension"
  | "path_rejected";
export interface RybbitCrawlerTrackingConfig {
  siteId?: string;
  websiteId?: string;
  domain?: string;
  apiUrl?: string;
  enabled?: boolean;
  includeSearchCrawlers?: boolean;
  disableAnswerFetch?: boolean;
  disableSearchCrawlers?: boolean;
  disableTrainingCrawlers?: boolean;
  disableOtherCrawlers?: boolean;
  methods?: string[];
  getIp?: (request: Request) => string | null | undefined;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxUrlLength?: number;
  ignoredPathPrefixes?: string[];
  additionalIgnoredPathPrefixes?: string[];
  ignoredExtensions?: string[];
  additionalIgnoredExtensions?: string[];
  shouldTrackPath?: (url: URL, crawler: AICrawlerMatch) => boolean;
  debug?: boolean;
}
export interface RybbitCrawlerTrackingResult {
  tracked: boolean;
  scheduled?: boolean;
  reason?: RybbitAICrawlerSkipReason | "api_error" | "network_error";
  crawler?: AICrawlerMatch;
  status?: number;
}
export interface WaitUntilContext {
  waitUntil?: (promise: Promise<unknown>) => void;
  response?: ResponseLike | null;
  statusCode?: number | null;
}
export type WaitUntilTarget =
  | WaitUntilContext
  | ((promise: Promise<unknown>) => void)
  | null
  | undefined;
export type ResponseLike =
  | Response
  | {
      status?: number | null;
      statusCode?: number | null;
    };
export declare function classifyAICrawlerUserAgent(
  userAgent: string | null | undefined
): AICrawlerMatch | null;
export declare function shouldTrackAICrawlerRequest(
  request: Request,
  config: RybbitCrawlerTrackingConfig
): RybbitCrawlerTrackingResult & { url?: URL };
export declare function trackAICrawlerRequest(
  request: Request,
  config: RybbitCrawlerTrackingConfig
): Promise<RybbitCrawlerTrackingResult>;
export declare function trackAICrawlerRequest(
  request: Request,
  context: WaitUntilTarget,
  config: RybbitCrawlerTrackingConfig
): RybbitCrawlerTrackingResult;
export declare function trackAICrawlerRequestInBackground(
  request: Request,
  context: WaitUntilTarget,
  config: RybbitCrawlerTrackingConfig
): RybbitCrawlerTrackingResult;
export declare function trackAICrawlerResponse(
  request: Request,
  response: ResponseLike,
  config: RybbitCrawlerTrackingConfig
): RybbitCrawlerTrackingResult;
export declare function trackAICrawlerResponse(
  request: Request,
  response: ResponseLike,
  context: WaitUntilTarget,
  config: RybbitCrawlerTrackingConfig
): RybbitCrawlerTrackingResult;
export declare function withAICrawlerTracking<TArgs extends unknown[]>(
  handler: (request: Request, ...args: TArgs) => Response | Promise<Response>,
  config: RybbitCrawlerTrackingConfig
): (request: Request, ...args: TArgs) => Promise<Response>;
export declare function createAICrawlerMiddleware(
  config: RybbitCrawlerTrackingConfig
): (request: Request, context?: WaitUntilTarget) => RybbitCrawlerTrackingResult;
export declare function createExpressAICrawlerMiddleware(
  config: RybbitCrawlerTrackingConfig
): (req: unknown, res: unknown, next?: () => void) => void;
