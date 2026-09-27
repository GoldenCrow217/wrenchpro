# ADR-0007: Hosting on Supabase (data), Vercel (web), and Render (API)

- Status: Accepted (2026-09-26, confirmed by the owner)

## Context

The SaaS needs managed PostgreSQL, sign-in, and file storage (ADR-0002, ADR-0004), hosting for the Next.js web app and customer portal, and an always-on server for the NestJS API. The API also needs scheduled/background work later (reminders, deferred-work follow-ups, notifications). No domain name has been purchased yet.

## Decision

| Piece | Service | Plan |
|---|---|---|
| PostgreSQL, Auth, Storage | **Supabase**, separate **dev** and **prod** projects | Free while building; **Pro (~$25/mo) before any real shop data** (daily backups, no auto-pause) |
| Web app + customer portal (Next.js) | **Vercel** | Hobby while building privately; **Pro (~$20/mo)** before commercial use (Hobby is non-commercial) |
| API (NestJS) | **Render** web service, **same region as the Supabase project** | Starter instance (~$7/mo), scaled as needed |
| Domain + transactional email | Registrar of choice + **Resend** (custom SMTP for Supabase Auth) | Buy the domain **before inviting real users** |

- **Why not the API on Vercel:** Vercel runs short-lived serverless functions. A long-running NestJS server with a database connection pool and scheduled jobs fits a persistent host better, and serverless request bodies are capped (~4.5 MB).
- **Uploads:** photos, video, and voice notes upload directly from the client to Supabase Storage with short-lived signed upload URLs issued by the API. They never pass through the API or Vercel.
- **Database connections from Render:** use Supabase's connection pooler string. Direct connections may require IPv6, so confirm what Render supports when provisioning.
- **Configuration:** all secrets are environment variables in each service's dashboard (never committed). Render will be described by a `render.yaml` blueprint once `apps/api` exists.
- **Until the domain exists:** use the default addresses (`*.vercel.app`, `*.onrender.com`). Adding the domain later means DNS records, Supabase Auth site/redirect URLs, the API's allowed origins/hosts (`WRENCHPRO_ALLOWED_ORIGINS`), and Resend sender verification.

## Estimated cost

$0 while building; about **$55/month** once real shops use it (Supabase Pro + Vercel Pro + Render Starter), plus per-message SMS/email later.

## Alternatives considered

- **Railway for the API:** equivalent capabilities; Render chosen for simpler setup.
- **Everything on Vercel:** simplest billing, but a poor fit for a long-running API and background jobs.
- **Self-managed VPS:** cheapest at scale, but backups, TLS, patching, and monitoring become our job.
