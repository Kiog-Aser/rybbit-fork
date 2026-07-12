# Rybbit Akash fork — lean self-hosting

This fork extends [Rybbit](https://github.com/rybbit-io/rybbit) for cheap self-hosting on [Akash](https://akash.network) (~$3–5/month) with **DataFast-style** extras:

- **Stripe revenue attribution** (restricted API key + per-site webhooks)
- **Bots dashboard** unlocked in self-hosted mode (includes AI crawler category)
- **Lite dashboard** materialized views for lower ClickHouse RAM
- **Journeys / funnels / goals** — unchanged from upstream

## Quick start (Docker Compose)

Best for local testing before Akash:

```bash
cp .env.akash.example .env
# Edit .env: BASE_URL, BETTER_AUTH_SECRET, passwords

docker compose -f docker-compose.yml -f docker-compose.akash.yml --env-file .env up -d --build
```

Open `BASE_URL`, create an account (unless `DISABLE_SIGNUP=true`), add a site, paste the tracking script.

### Lean mode flags (set by `docker-compose.akash.yml`)

| Variable | Effect |
|----------|--------|
| `AKASH_LEAN_MODE=true` | Enables lite dashboard + revenue attribution |
| `LITE_DASHBOARD=true` | Hourly MVs instead of heavy live queries |
| `CLUSTER_WORKERS=1` | Single Node worker |
| `REVENUE_ATTRIBUTION=true` | Stripe revenue module + UI |
| ClickHouse `akash-config.xml` | ~400MB server memory cap |

Session replay stays off in lean mode (saves RAM and disk).

## Build your own images (required for fork features)

The public `ghcr.io/rybbit-io/rybbit-*` images do **not** include this fork. Build and push before Akash deploy:

```bash
export REGISTRY=ghcr.io/your-user
export TAG=akash

docker build -t $REGISTRY/rybbit-backend:$TAG -f server/Dockerfile .
docker build -t $REGISTRY/rybbit-client:$TAG -f client/Dockerfile \
  --build-arg NEXT_PUBLIC_BACKEND_URL=https://analytics.yourdomain.com \
  --build-arg NEXT_PUBLIC_DISABLE_SIGNUP=true \
  --build-arg NEXT_PUBLIC_LITE_DASHBOARD=true \
  --build-arg NEXT_PUBLIC_DEPLOYMENT=akash \
  --build-arg NEXT_PUBLIC_REVENUE_ATTRIBUTION=true \
  .

docker push $REGISTRY/rybbit-backend:$TAG
docker push $REGISTRY/rybbit-client:$TAG
```

Then edit `akash/deploy.yaml` `image:` lines for `backend` and `client`.

## Akash deploy

1. Copy `.env.akash.example` values into the SDL env section (or use Akash secrets).
2. Import `akash/deploy.yaml` in [Akash Console](https://console.akash.network).
3. Set `BASE_URL` / `NEXT_PUBLIC_BACKEND_URL` to your public URL (client exposes port 80 globally).
4. Fund the deployment with ACT (pricing block targets ~$3–5/mo; adjust `amount` if bids fail).
5. Run Postgres migrations on first boot — the backend runs Drizzle migrate on startup.

Resource budget: **~2GB RAM** total (512 CH + 512 PG + 128 Redis + 768 backend + 256 client + 64 caddy).

## Stripe revenue attribution

### 1. Connect Stripe (dashboard)

**Site Settings → Integrations → Stripe Revenue**

1. Click **Create restricted Stripe key** (opens Stripe with read-only permissions pre-selected).
2. Paste the `rk_live_…` or `rk_test_…` key.
3. Optionally paste a webhook signing secret after step 2.

### 2. Webhook (per site)

In Stripe Dashboard → Developers → Webhooks, add:

```
POST https://your-domain.com/api/sites/{siteId}/revenue/stripe/webhook
```

Events: `checkout.session.completed`, `payment_intent.succeeded`.

Paste the signing secret when connecting (or reconnect to update).

### 3. Pass attribution metadata at checkout

The tracking script exposes `window.rybbit.getStripeMetadata()` (also `datafast_*` aliases for compatibility):

```javascript
// Stripe Checkout (client-side redirect)
const metadata = window.rybbit.getStripeMetadata();

await stripe.redirectToCheckout({
  sessionId: session.id,
  // When creating the session server-side, merge metadata:
});

// Server-side Checkout Session creation (Node example)
const metadata = req.body.metadataFromClient ?? {};
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [{ price: "price_xxx", quantity: 1 }],
  success_url: "https://yoursite.com/success",
  cancel_url: "https://yoursite.com/cancel",
  metadata: {
    ...window.rybbit.getStripeMetadata(), // from your frontend POST body
  },
});
```

Recommended flow: frontend calls your API with `rybbit.getStripeMetadata()`, backend merges into `metadata` on `checkout.sessions.create` or `paymentIntents.create`.

Metadata keys used for attribution:

| Key | Source |
|-----|--------|
| `rybbit_user_id` | `identify()` user id or visitor id |
| `rybbit_session_id` | Visitor id (client proxy for session) |
| `rybbit_channel` | UTM / referrer derived channel |
| `rybbit_referrer` | `document.referrer` |
| `rybbit_pathname` | Current path |

### 4. View revenue

Sidebar → **Revenue** — totals and breakdown by channel for the selected date range.

Revenue events are stored in ClickHouse `revenue_events` with a **90-day TTL**.

## Bots & AI crawlers

Sidebar → **Bots** (enabled when `REVENUE_ATTRIBUTION` or cloud). Uses upstream bot detection including the `ai` category (GPTBot, ClaudeBot, etc.).

## AGPL note

Rybbit is AGPL-3. If you modify this fork and let users interact with it over a network, you must offer corresponding source. For private analytics on your own sites, typical self-host use is fine — keep a fork URL or source offer if you expose it publicly.

## Updating safely

Upstream Rybbit (e.g. **v2.7.0** on Rybbit Cloud) is **not** what your self-hosted fork runs. The “update available” toast used to compare against `app.rybbit.io` — that is disabled when `NEXT_PUBLIC_FORK_REPO` is set (Akash Images CI sets this automatically).

### Pull upstream without losing fork work

1. **GitHub Actions** → **Sync upstream** → enter tag (e.g. `v2.7.0`) → opens a PR.
2. Or locally: `./akash/sync-upstream.sh v2.7.0`
3. Fork-only paths in `akash/fork-overlay.paths` auto-resolve on conflict; review shared files (`server/src/index.ts`, `package.json`, auth).
4. Merge PR to `master` → **Akash Images** builds `akash-<sha>` tags.

### Go live on the droplet

Building images does **not** deploy by itself. After CI succeeds:

```bash
./akash/deploy-droplet.sh <7-char-sha>   # e.g. cdc74d5
```

Or **Actions → Akash Images → Run workflow** with **Deploy production** checked (requires repo secrets `DEPLOY_HOST`, `DEPLOY_SSH_KEY`).

Immutable tags: always use `akash-<git-sha>`, not mutable `akash` or `akash-v2`.

## What's not in this fork yet

- Auto-generated “insights” (rule-based or LLM)
- Historical Stripe backfill (webhook-only ingestion)
- Dedicated “AI bots only” filter tab (use Bots dashboard categories)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **502 on `/api/*` (login broken)** | Backend group must show **1 ready replica**. Rebuild with `akash-v2` image tag, update SDL, redeploy. Click **View logs** on the backend group if still 0. |
| **Postgres 0 ready replicas, no logs** | Set `PGDATA=/var/lib/postgresql/data/pgdata` in postgres env (Akash persistent volumes put `lost+found` on the mount root and initdb fails). Use **1Gi** RAM. If still 0 after redeploy, **close deployment and create a fresh one** (wipes DB volume). |
| **Backend 0 ready replicas** | Usually OOM. Use `akash-<7-char-sha>` image, backend **1Gi** RAM, `DISABLE_GEOLITE=true`. View backend logs for `Killed` / exit 137. |
| `demo.rybbit.com` ERR_BLOCKED_BY_CLIENT | Harmless — login page globe widget + ad blocker; not your API |
| Revenue page empty | Confirm webhook fires, metadata on checkout, signing secret set |
| OOM on Akash | Lower ClickHouse in `clickhouse/akash-config.xml`; reduce retention |
| Client shows no Revenue nav | Rebuild client with `NEXT_PUBLIC_REVENUE_ATTRIBUTION=true` |
| Migration errors | Ensure Postgres volume is persistent; check backend logs |