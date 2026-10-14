# eSIM Compare

An esimdb.com-style comparison site for travel eSIMs. English only.

- **Website**: Next.js 16 (App Router), server-rendered pages for every destination, provider, promo code and Top 10 list.
- **Admin**: Payload CMS 3 at `/admin` for providers, plans, coupons, rankings and review moderation.
- **Scraper**: Node worker that refreshes prices, Trustpilot scores and reviews, and logos every 24 hours through your proxies. See [scraper/README.md](scraper/README.md).
- **Database**: Postgres in production, SQLite file for quick local runs.

## Pages

| URL | What it shows |
| --- | --- |
| `/` | Search, destinations with starting prices, providers, FAQ |
| `/esim/[country]` | Every plan for a country with filters, sorting, highlight cards and a 3-plan compare |
| `/best-esim`, `/best-esim/[country]` | Top 10 rankings (automatic score + editor pins/exclusions) |
| `/promo-codes`, `/promo-codes/[provider]` | Working codes, how-to, cheapest plans, FAQ (with FAQ schema), expired codes |
| `/providers`, `/providers/[provider]` | Plans by country, Trustpilot reviews (attributed and linked), reader reviews + review form |
| `/how-we-rank` | Ranking method |
| `/go/[provider]?plan=` | Affiliate redirect, logs a click |
| `/review-submit` | POST endpoint for reader reviews (validated, honeypot, rate limited, held for moderation) |
| `/sitemap.xml`, `/robots.txt` | SEO |

## Run locally

```bash
cp .env.example .env          # leave DATABASE_URI empty for SQLite
npm install
npm run seed                  # sample catalog + admin user (password printed once)
npm run dev                   # http://localhost:3000, admin at /admin
npm test                      # ranking + scraper parser tests
```

## Deploy on a server (Docker)

Needs a Linux server with Docker and a domain pointing at it.

```bash
git clone <repo> esim && cd esim
cp .env.example .env
# set DOMAIN, SITE_URL=https://DOMAIN, POSTGRES_PASSWORD, PAYLOAD_SECRET, SCRAPER_PROXIES
docker compose up -d --build
docker compose exec web npx tsx scripts/seed.ts     # first time only
```

Services: `db` (Postgres 16), `web` (site + admin, runs migrations on start), `worker` (scraper on `SCRAPER_CRON`, default 03:00 UTC daily), `caddy` (HTTPS via Let's Encrypt).

Useful commands:

```bash
docker compose logs -f worker                          # scraper output
docker compose exec worker npm run scrape -- prices --provider airalo --dry-run
docker compose exec worker npm run scrape -- all
```

## Database changes

Schema lives in `src/collections`. After changing a collection:

```bash
DATABASE_URI=postgres://... npx payload migrate:create <name>
```

Commit the file in `src/migrations`; the web container applies it on the next start.

## Rankings

`src/lib/ranking.ts` scores each provider out of 10: price per GB 35%, Trustpilot 25%, coverage 15%, features 15%, plan choice 10%. In the admin, a ranking in **hybrid** mode keeps that order but lets an editor pin a provider to a position, exclude one, mark a row sponsored, and add a badge, pros, cons and a note.

## Reviews

- Trustpilot reviews are stored with `source = trustpilot`, shown with a "Review via Trustpilot" label that links to the original review, plus the TrustScore and review count.
- Reader reviews arrive as `pending` and appear after an admin sets them to `approved` (Admin → Community → Reviews).
