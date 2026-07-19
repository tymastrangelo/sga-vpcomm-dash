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
The Cloudflare adapter's platform proxy gives `vite dev` a real local D1
(stored under `.wrangler/state/`), so no separate wrangler server is needed.

Sanity check for the recurrence/calendar date math:

```bash
node scripts/check-dates.ts
```

## Environment variables

| var | what |
|---|---|
| `AUTH_USER` | the one login email |
| `AUTH_PASSWORD` | the one login password |
| `SESSION_SECRET` | long random string; signs the session cookie. Rotating it logs you out everywhere |
| `NTFY_TOPIC` | ntfy.sh topic for daily digests. Treat like a password — anyone who knows it can read/send |

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
