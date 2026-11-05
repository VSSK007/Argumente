# Deployment guide

Argumenté is two containers plus Postgres: **api** (FastAPI), **web** (Next.js, which proxies `/api/v1/*` to the API at *runtime* via `API_URL`, so one image works anywhere). Verified here: `docker compose up --build` end to end, and the full test suite on Postgres 16. **Not verified:** the Render and Fly files below have never been run against real accounts, so expect to adjust a field or two the first time.

## What you need
1. A host (Render or Fly below, or any Docker host).
2. A domain or the host's URL (it must be HTTPS: passkeys require it).
3. An email service for sign-in links (any SMTP: Postmark, Resend, Mailgun, SES…). Without it, links only appear in the API log.
4. Optional: an Anthropic API key. Without it the offline engine is used.

## Settings (API)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres URL. `postgres://` and `postgresql://` are accepted. |
| `ARGUMENTE_SECRET` | Signs short-lived stream tickets. Long random string; keep it stable. |
| `ARGUMENTE_DEV` | Must be `0`/unset in production (turns instant dev sign-in off). |
| `WEB_ORIGIN` | The public web URL, e.g. `https://argumente.example.com`. Used in sign-in links and passkeys. |
| `WEBAUTHN_RP_ID` | The web hostname only, e.g. `argumente.example.com`. |
| `ADMIN_EMAILS` | Comma-separated moderators (they also see Metrics). |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` `MAIL_FROM` | Email (sign-in links and "your turn" nudges). |
| `ANTHROPIC_API_KEY` | Optional. Models: `ENGINE_ANALYZE_MODEL`, `ENGINE_FAST_MODEL`. |
| `RATE_LIMIT_*`, `RETENTION_DAYS`, `SESSION_DAYS` | Optional tuning. |

Web: `API_URL` (the API's URL, e.g. `https://argumente-api.onrender.com`).

## Render
1. Push the repo to GitHub. In Render: **New → Blueprint** and pick the repo (it reads `render.yaml`).
2. Fill the prompted values (`WEB_ORIGIN`, `WEBAUTHN_RP_ID`, `ADMIN_EMAILS`, optional SMTP and key, and `API_URL` for the web service). The URLs are known after the first deploy; set them, then redeploy.
3. Free web services sleep when idle and the free database expires after 30 days. That's fine to test, not to keep.

## Fly.io
```bash
cd services/api && fly launch --copy-config --no-deploy
fly postgres create --name argumente-db && fly postgres attach argumente-db   # sets DATABASE_URL
fly secrets set ARGUMENTE_SECRET=$(openssl rand -hex 32) WEB_ORIGIN=https://argumente-web.fly.dev \
  WEBAUTHN_RP_ID=argumente-web.fly.dev ADMIN_EMAILS=you@example.com   # + SMTP_* / ANTHROPIC_API_KEY
fly deploy
cd ../../apps/web && fly launch --copy-config --no-deploy
fly secrets set API_URL=https://argumente-api.fly.dev && fly deploy
```

## Any Docker host
`docker compose up --build -d` with a `.env` next to `docker-compose.yml` holding the settings above, behind a reverse proxy (Caddy/nginx) terminating HTTPS on the web service. Only the web service needs to be public; keep the API private if you can (the web service reaches it at `API_URL`).

## Before you invite people
- [ ] Send yourself a sign-in link through the real email service. Add a passkey from Me and sign in with it.
- [ ] Sign in as an `ADMIN_EMAILS` address: the **Moderation** link and metrics should appear.
- [ ] Run one Chamber with two accounts end to end.
- [ ] Set up backups (below) and try a restore once.
- [ ] Fill in the operator name and contact in `/privacy` and `/terms`, and have them reviewed.
- [ ] Set `ADMIN_EMAILS` to someone who will actually read reports.

## Backups
`DATABASE_URL=... ./scripts/backup.sh /path/to/backups` writes a dated, owner-only file (`pg_dump` custom format for Postgres, an online copy for SQLite) and keeps the newest 14. Run it daily (cron / Render cron job / Fly scheduled machine) and copy the files off the host. Restore Postgres with `pg_restore --clean --no-owner -d "$DATABASE_URL" file.dump`. Backups contain everyone's private Chamber content until retention purges it: store them as carefully as the database itself.

## Security notes
- Security headers are set in `apps/web/next.config.ts` (CSP, HSTS in production, no framing, strict referrer). The CSP allows inline scripts because Next's bootstrap needs them; a nonce-based CSP would force every page to render dynamically, a larger change worth making before a wide public launch.
- Sessions are bearer tokens kept in the browser's local storage (not cookies), valid 30 days, revocable from Me.
- Rate limits are in memory, per API process: run one API instance, or move them to Redis before scaling out.
- Realtime updates poll the database per open Chamber; fine for tens of simultaneous Chambers, not thousands.
- Several people sharing one account-creation path means one person can still make many accounts. Topic voting is the place this matters; consider requiring a passkey or verified email to vote before a public launch.
