# SGA Comms Content Calendar

Single-user content calendar + task tracker for Elon SGA's VP of Communications.
SvelteKit + Tailwind on Cloudflare Pages, data in Cloudflare D1. One login, no accounts.

## Local development

```bash
npm install
cp .env.example .env          # then set AUTH_PASSWORD and SESSION_SECRET
npx wrangler d1 execute sga-calendar-db --local --file=./schema.sql
npm run dev
```

Open http://localhost:5173 and log in with the credentials from `.env`.

**`npm run dev` reads the live production D1**, so localhost shows exactly what the
deployed site shows. That needs `npx wrangler login` once, and it means local writes
are real writes — a task you add while developing appears on the live site.

```bash
npm run dev        # against the real deployed database (default)
npm run dev:local  # against the local copy in .wrangler/state — offline-safe, throwaway
```

The switch is the `remote = true` flag on the D1 binding in `wrangler.toml`; `dev:local`
sets `LOCAL_DB=1`, which turns remote bindings off in the platform proxy. Neither
affects deploys.

Sanity check for the recurrence/calendar date math:

```bash
node scripts/check-dates.ts
node scripts/check-instagram.ts
```

## Environment variables

| var | what |
|---|---|
| `AUTH_USER` | the one login email |
| `AUTH_PASSWORD` | the one login password |
| `SESSION_SECRET` | long random string; signs the session cookie. Rotating it logs you out everywhere |
| `NTFY_TOPIC` | ntfy.sh topic for daily digests. Treat like a password — anyone who knows it can read/send |
| `IG_ACCESS_TOKEN` | *optional.* Bootstraps the Instagram connection; normally you paste the token in the app instead |
| `IG_USER_ID` | *optional.* Numeric Instagram account id, paired with `IG_ACCESS_TOKEN` |
| `IG_API_BASE` | *optional.* `https://graph.facebook.com` (default) or `https://graph.instagram.com` |

- **Local:** in `.env` (gitignored — never commit it).
- **Production:** set in the Cloudflare Pages dashboard (Settings → Environment variables),
  or `npx wrangler pages secret put AUTH_PASSWORD` etc. Never commit real values.

## Database (D1)

Schema + seed data live in one file, `schema.sql` (it drops and recreates tables — it's a reset, not a migration).

```bash
npx wrangler d1 create sga-calendar-db          # once; paste the returned id into wrangler.toml
npx wrangler d1 execute sga-calendar-db --local  --file=./schema.sql
npx wrangler d1 execute sga-calendar-db --remote --file=./schema.sql
```

For future schema changes, write a small `NNN-change.sql` and apply it the same way
(don't rerun `schema.sql` against a database with real data). Existing migrations live
in `migrations/` — if your database predates one, apply it with the same
`wrangler d1 execute` command (local and remote).

## Deploy (Cloudflare Pages)

1. Push this repo to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
   Build command `npm run build`, output dir `.svelte-kit/cloudflare`.
3. Settings → Functions → D1 database bindings → bind `DB` → `sga-calendar-db`.
4. Settings → Environment variables → add `AUTH_USER`, `AUTH_PASSWORD`, `SESSION_SECRET`.
5. Apply the schema remotely (step above) if you haven't.
6. Custom domain: Pages project → Custom domains → add `sga.tymastrangelo.com`.
   - If `tymastrangelo.com` DNS is on Cloudflare, the CNAME is created automatically.
   - If not, either move the nameservers to Cloudflare or add a CNAME
     `sga` → `<project>.pages.dev` at your DNS host.
7. Verify the live URL redirects to `/login` when signed out.

## Daily notifications (ntfy)

A small standalone Worker (`notifier/`) runs on a Cloudflare cron trigger at
12:00 UTC (8 AM EDT / 7 AM EST), reads the same D1 database, and pushes a digest
to your ntfy topic: what to post today (with times/platforms/status), tasks due,
overdue items, and a peek at tomorrow.

Setup:

1. Install the [ntfy](https://ntfy.sh/) app and subscribe to the topic shown on the
   app's **Settings** page (`NTFY_TOPIC` in `.env` / Pages env vars).
2. Deploy the worker once: `npm run deploy:notifier`
   (it shares `notifier/wrangler.toml` config — D1 binding and topic are already in there).
3. Use **Settings → Send test notification** to verify end to end any time.

Cron is UTC, so the digest shifts an hour with DST (8 AM in summer, 7 AM in winter).
Edit `crons` in `notifier/wrangler.toml` if that bugs you.

## How recurring tasks work

A recurring task is a normal row with `is_recurring=1`. Checking it off marks that
occurrence done (kept as history) and inserts the next one — weekly = +7 days,
monthly = same day next month clamped to day 28 so February can't break it.
Nothing is scheduled by cron; if you never check it off, it just waits on its date.

## Instagram stats

`/instagram` reads the account's own numbers straight from Meta's Graph API
(v25.0) and stores them in D1, so the dashboard has history the API itself won't
give you twice.

**Connecting.** The account must be a Business or Creator account. Create a Meta
app, add the Instagram product, and generate a long-lived access token with
`instagram_basic` and `instagram_manage_insights`. Paste the token and the numeric
account id into the setup form on `/instagram`; it verifies them against the API
before saving. Credentials live in the `app_settings` table rather than env vars
so the token can be replaced (and, on the Instagram Login path, auto-refreshed)
without a redeploy.

Two login paths, both supported — pick at connect time:

| | Facebook Login | Instagram Login |
|---|---|---|
| host | `graph.facebook.com` | `graph.instagram.com` |
| needs a linked Facebook Page | yes | no |
| story insights | yes | no |
| demographics | yes | no |
| token refresh | regenerate in Meta's dashboard | one click in the app |
| batched requests | yes (50 per call) | no |

**Syncing.** The notifier Worker runs every 4 hours and syncs before it considers
the digest; "Sync now" on the page does the same thing on demand. Four-hourly is
deliberate — story insights vanish 24 hours after posting, so a daily sync would
miss most of them. Each run has a call budget (Meta rate-limits, and Cloudflare
caps subrequests per invocation), so a large back catalogue fills in over several
runs; the page shows how many posts are still pending.

**What's stored.** `ig_media` holds one row per post/reel/carousel/story with the
metrics the charts use, plus `metrics_json` with everything the API returned —
so a post's detail view is complete even for metrics this app never modelled.
`ig_day` holds daily account totals and follower snapshots, `ig_audience` the
latest demographics snapshot, and `ig_sync` a log of every run.

Long-lived tokens expire after **60 days**. The Connection panel on `/instagram`
shows which path you're on and refreshes the token in place where that's possible.

### Demo data

Settings → *Instagram demo data* fills the dashboard with realistic generated
numbers, so every chart can be seen without a connected account. It is **off by
default** — the dashboard shows the real account unless you turn it on.

The flag is a session cookie, not a database row, deliberately: dev points at the
live D1, so a stored setting would flip demo mode on for the real site too. As a
cookie it applies to your browser only, and clears when you close it. Syncing is
disabled while it's on. The generator (`src/lib/mockInstagram.ts`) derives every
figure from a hash of its own date, so widening the range extends history instead
of reshuffling it.
