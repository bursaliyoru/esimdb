# Scraper

Collects eSIM plans and prices, Trustpilot scores/reviews and provider logos, and writes them to the
site's Payload database through the Local API.

> **First live run needed.** This code was written without network access to the provider sites or
> Trustpilot. Every adapter endpoint below is **UNVERIFIED** until it has run once against the live
> site. Parsing logic is unit-tested against hand-made fixtures in `scraper/fixtures/`, not real captures.
> Start with `--dry-run`, check the output, and replace fixtures with real (trimmed) responses.

## Running

```bash
npm run scrape -- --help
npm run scrape                                  # all jobs: prices, trustpilot, logos
npm run scrape -- prices --provider airalo --dry-run
npm run scrape -- prices --provider saily --countries JP,FR --dry-run
npm run scrape -- trustpilot
npm run scrape -- logos --force                 # re-download logos even if logoUrl is set
npm run scrape -- prices --no-proxy             # ignore SCRAPER_PROXIES
npm run worker                                  # long-running cron worker
npm test                                        # parser unit tests (no network)
```

`--dry-run` fetches and prints results but writes nothing (no DB rows, no logo files). If the DB has no
providers yet, a dry run falls back to the built-in provider list in `adapters/index.ts`.

Exit code: `1` if every price adapter that ran failed (or on a fatal error), `2` on bad arguments, else `0`.
Stub adapters are skipped in full runs and don't count; `--provider <stub>` runs them (and fails).

## What a price run does

For each active provider whose adapter (`providers.scraper`, or the slug) is implemented:

1. The adapter returns `ScrapedPlan[]` (validated with zod in `types.ts`); prices are converted to USD
   (`currency.ts`: open.er-api.com → frankfurter.app → static fallback table).
2. `sync.ts` upserts plans by `key = providerSlug:externalId` (`source: 'scraper'`, `active: true`,
   `lastSeenAt`), mapping ISO2 codes to `countries` (missing countries are created with their English
   name) and `regionSlug` to `regions` (missing regions are created).
3. A `price-snapshots` row is written for new plans and whenever `priceUsd` changes.
4. The provider's active `scraper` plans not seen in this run are set `active: false`. The provider's
   sample `seed` plans are retired the same way once real data exists (`SCRAPER_DEACTIVATE_SEED=false`
   to keep them). `manual` plans are never touched.
5. `providers.lastScrapedAt / lastScrapeStatus` are updated and a `scrape-runs` row is written.

**A failed adapter — or one that returns 0 valid plans — never deactivates anything.**

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URI` | empty → SQLite `data/esimdb.db` | Postgres URL in production |
| `SCRAPER_PROXIES` | empty | Comma-separated `http://user:pass@host:port`; rotated per request and on every retry |
| `SCRAPER_HOST_DELAY_MS` | `1500` | Minimum gap between requests to the same host (+ up to 50% jitter) |
| `SCRAPER_TIMEOUT_MS` | `30000` | Per-request timeout |
| `SCRAPER_RETRIES` | `3` | Retries on network errors, 403/408/425/429/5xx (exponential backoff + jitter, honours `Retry-After`) |
| `SCRAPER_MAX_COUNTRIES` | `0` (all) | Cap for per-country adapters (Saily, Nomad, Ubigi, Airalo website mode) |
| `SCRAPER_CRON` | `0 3 * * *` | Worker schedule, UTC |
| `SCRAPER_RUN_ON_START` | `false` | Worker also runs once at startup |
| `SCRAPER_NO_PROXY` | `false` | Worker equivalent of `--no-proxy` |
| `SCRAPER_DEACTIVATE_SEED` | `true` | Retire seed sample plans after a successful scrape |
| `SCRAPER_DEBUG` | `false` | Verbose logging |
| `TRUSTPILOT_ENABLED` | `true` | Set `false` to skip the Trustpilot job |
| `TRUSTPILOT_API_KEY` | empty | Use the official Trustpilot API instead of the web page |
| `TRUSTPILOT_PAGES` | `2` | Web mode: review pages to read (20 reviews kept per provider) |
| `AIRALO_CLIENT_ID` / `AIRALO_CLIENT_SECRET` | empty | Use the Airalo Partner API instead of website JSON |
| `AIRALO_WEB_API` | `https://www.airalo.com/api/v2` | Base for website mode |
| `HOLAFLY_PRODUCTS_URL` / `HOLAFLY_CURRENCY` | Shopify `products.json` / `USD` | Holafly source + currency |
| `SAILY_URL_TEMPLATE`, `NOMAD_URL_TEMPLATE`, `UBIGI_URL_TEMPLATE` | see below | Per-country URL; placeholders `{slug}` `{iso2}` `{iso2lower}` `{name}` |
| `SAILY_CURRENCY`, `NOMAD_CURRENCY`, `UBIGI_CURRENCY` | `USD` | Used only when the payload has no currency |

`.env` in the project root is loaded automatically. Without `SCRAPER_PROXIES` (or with `--no-proxy`)
requests go direct but still honour the standard `HTTPS_PROXY`/`NO_PROXY` variables.

### Proxies

Use residential or ISP proxies in one fixed country (prices and currencies can vary by visitor
location — e.g. Ubigi shows EUR to European IPs). Rotation is round-robin; a 403/429 retries through the
next proxy. The per-host delay applies regardless of proxies — keep it ≥ 1 s.

## Adapters

| Provider | Status | Source |
| --- | --- | --- |
| airalo | implemented, **UNVERIFIED** | Partner API `partners-api.airalo.com/v2/token` + `/v2/packages` when credentials are set (documented, compliant); otherwise the website JSON `www.airalo.com/api/v2/countries`, `/countries/{slug}`, `/regions`, `/regions/{slug}` |
| holafly | implemented, **UNVERIFIED** | Shopify storefront `esim.holafly.com/products.json?limit=250&page=N` (one product per destination, one variant per duration) |
| saily | implemented, **UNVERIFIED** | `https://saily.com/esim-{slug}/` pages → embedded `__NEXT_DATA__` / App Router flight JSON / JSON-LD |
| nomad | implemented, **UNVERIFIED** (URL is a guess) | `https://www.getnomad.app/{slug}-esim` pages, same generic parser |
| ubigi | implemented, **UNVERIFIED** (URL is a guess) | `https://cellulardata.ubigi.com/destinations/{slug}/` pages, same generic parser |
| maya, yesim, jetpac, gigsky, bnesim | stub | throws `adapter not implemented yet` |

The page-based adapters find plans by field names (price / data / validity, see `parse.ts →
readPlanCandidate`), so they survive small markup changes. If a site turns out to load plans from a
JSON API instead, point `<KEY>_URL_TEMPLATE` at that endpoint — JSON bodies use the same parser.
Known limitation: plans shown on a country page are attributed to that single country even if the
provider actually sells them as regional bundles.

### Verifying an adapter on the first live run

1. `npm run scrape -- prices --provider saily --countries JP --dry-run` (add `SCRAPER_DEBUG=true`).
2. If it finds nothing, save the page/JSON (`curl` through your proxy), look for the plan data
   (DevTools → Network, or search the HTML for a known price), then either adjust the URL template or
   write a provider-specific parser.
3. Replace the hand-made fixture with a trimmed real response and update the test.
4. Mark it verified in the table above.

## Adding an adapter

1. Create `scraper/adapters/<key>.ts` exporting an `Adapter` (`key`, `providerSlug`, `implemented: true`,
   `source`, `fetchPlans(ctx)`). Keep fetching (`ctx.http.getJson / getText`) separate from a pure,
   exported `parse…()` function.
2. Return plans with: stable `externalId` (unique per provider), ISO2 `countries`, `scope`, `regionSlug`
   for regional plans, `dataMb` (`null` = unlimited; for "X GB/day" set `dailyMb` and total = daily × days),
   `validityDays`, `price` + `currency` in the provider's currency (USD conversion happens centrally).
3. For one-page-per-country sites, use `perCountryPageAdapter()` from `adapters/common.ts`.
4. Register it in `adapters/index.ts` and set `providers.scraper` to the key in the admin (or use the slug).
5. Add a fixture in `scraper/fixtures/` and a test in `scraper/tests/`.

## Scheduling

Pick one:

- **Worker process** — `npm run worker` under pm2/systemd/Docker. Uses `SCRAPER_CRON` (UTC) and never
  overlaps runs.
- **System cron** — `0 3 * * * cd /srv/esimdb && npm run scrape >> /var/log/esim-scrape.log 2>&1`
- **GitHub Actions** — `.github/workflows/scrape.yml` runs daily at 03:00 UTC (and on demand).
  Secrets: `DATABASE_URI` (Postgres reachable from GitHub), `PAYLOAD_SECRET`, `SCRAPER_PROXIES`, optional
  `TRUSTPILOT_API_KEY`, `AIRALO_CLIENT_ID`, `AIRALO_CLIENT_SECRET`. Downloaded logos are committed back
  to `public/logos`. The SQLite DB is not usable there (not persisted).

## Trustpilot

`trustpilot.ts` updates `trustScore`, `trustReviewCount`, `trustUpdatedAt` and keeps the latest 20
reviews per provider (`source: 'trustpilot'`, `status: 'approved'`, `externalId: tp_<id>`,
`externalUrl: https://www.trustpilot.com/reviews/<id>`).

Trustpilot's terms restrict automated collection of their pages. The compliant option is the official
API: set `TRUSTPILOT_API_KEY` and the job uses `/v1/business-units/find`, `/v1/business-units/{id}` and
`/v1/business-units/{id}/reviews` instead of the web page. Without a key it parses
`trustpilot.com/review/<domain>` `__NEXT_DATA__` — get sign-off before running that in production, or set
`TRUSTPILOT_ENABLED=false`.

## Logos

`logos.ts` reads the provider's homepage and tries, in order: largest `apple-touch-icon`, JSON-LD
Organization `logo`, `og:image`, largest `<link rel="icon">` (SVG preferred), `/favicon.ico`. The first
candidate that downloads as an image is saved to `public/logos/<slug>.<ext>` and `logoUrl` is set to
`/logos/<slug>.<ext>`. Only providers without `logoUrl` are processed unless `--force` is passed.

## Files

```
scraper/
  run.ts         CLI            worker.ts   cron worker        pipeline.ts  job runner
  http.ts        HTTP client    currency.ts USD conversion     parse.ts     pure parsing helpers
  sync.ts        price job + DB writes                         types.ts     ScrapedPlan schema, Adapter
  trustpilot.ts  Trustpilot     logos.ts    logo fetcher       providers.ts / db.ts / log.ts
  adapters/      one file per provider + index.ts registry + common.ts
  fixtures/      hand-made test payloads    tests/      node:test unit tests
```
