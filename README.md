# nivo-lite

NIVO OS lite: the responsibility operating system for founder-led service businesses, one app with a Nest API, a Next web app and Supabase as the backing service.

## Overview

NIVO gives every piece of work one accountable owner (a person or an AI agent), one explicit next action and the evidence of its outcome; a person approves anything that leaves the company. Owners run it through the Office team chat, the authority rules, the inbox, leads, decisions, the second brain and the agent modules, over Telegram, Zalo, Meta, Google and bank-transfer channels.

The conversion to the StarCi lite shape is the full architecture on one managed Supabase project: PostgreSQL through the `primary` connection, Auth and Storage through the Supabase integration, and background jobs on Supabase Queues (pgmq) in the same database. There is no test world and no end-to-end run for the front end; the back end has unit specs. The browser uses only the public Supabase client under row-level security and the API with the user's access token; privileged Auth and Storage operations and every provider webhook stay behind the API.

## Stack

TypeScript everywhere, NestJS in `be/`, Next.js with next-intl in `fe/`, Supabase for Auth, PostgreSQL and Queues, npm workspaces, and Turbo for front-end tasks. OpenClaw (the agent gateway) and n8n run next to the API on one VPS behind a Traefik edge; images are built from the repository root.

## Repository layout

- `be/`: the API and the command line, the shared platform capabilities, verified identity admission, the privileged Supabase integrations, the queues and the back-end documentation (`be/docs`).
- `fe/`: the web app; every Supabase read and write is owned by the db module of the app, and the API is reached through one client.
- `supabase/`: local configuration, forward-only SQL migrations, seed data and the generated database types.
- `.starcistacks/`: value-free environment metadata and encrypted-secret custody only.
- `.starciwork/`: the product workspace, brand and shell records.
- `scripts/`: operational scripts (secrets loading and sync, seeds that are still being moved into the command line).
- `deploy/`: the VPS side of the delivery: the edge routes, the api and OpenClaw stack and the web container (see `be/docs/runbooks/vps-stack.md`).

## Development

```sh
npm install
npm run contract:emit
npm run typecheck
npm run lint
npm test
npm run build:be
npm run build:fe
```

The API reads `PORT`, `HTTP_SECURITY_ALLOWED_ORIGINS`, `PRIMARY_DB_URL`, `PRIMARY_DB_SCHEMA`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the queue tunables `QUEUE_RELAY_INTERVAL`, `QUEUE_RELAY_BATCH`, `QUEUE_CONCURRENCY`, `QUEUE_POLL_INTERVAL` and `QUEUE_VISIBILITY_TIMEOUT` are optional. The web app reads `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEVELOPER_API_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. A missing required key stops the process with the key's name; no template supplies credential defaults.

Run it locally:

1. Copy `secrets.example.env` to `~/.nivo-lite/secrets.env` (override the path with `NIVO_SECRETS`) and fill it in. It is kept outside the repository, and `scripts/set-secrets.ps1` sets the sensitive keys without echoing them.
2. Start the local Supabase stack with `npm run db:start` (it applies the migrations; copy the printed anon and service role keys into the secrets file). Local ports are the Supabase defaults plus 1000 so it runs next to other local stacks, and local email (invites, password reset) lands in its Inbucket mail catcher.
3. Run the API with `node scripts/with-secrets.mjs npm run dev:be` and the web app with `node scripts/with-secrets.mjs npm run dev:fe` (port 3100).

Images: `npm run docker:build` builds the API and command line images; the web image is `docker build -f fe/apps/web/Dockerfile .` from the root. Deploys are manual workflows, described with the cutover in `be/docs/runbooks/cutover.md`.

Guides and runbooks live in `be/docs`: `guides` for how the system works (jobs, second brain, connecting channels, adding an agent module) and `runbooks` for operating it (cutover, VPS stack, job operations, DNS rollback, lite baseline, migration re-stamp map).

## Accounts and sessions

Every person has their own sign-in (email and password, or Google) and a role in the workspace: `owner`, `manager` or `staff`. People join through an invite from the Team page; the invite link creates the account (or signs in) and accepts the membership. The account page shows the profile, password change and active sessions with per-session and "all other devices" sign-out. Invite emails go over SMTP (`SMTP_URL`); "Copy invite link" works without email.

## Work

The product's Work records live in `.starciwork`.
