# nivo-lite

NIVO OS lite: the responsibility operating system for founder-led service businesses, one app with a Nest API, a Next web app and Supabase as the backing service.

## Overview

NIVO gives every piece of work one accountable owner (a person or an AI agent), one explicit next action and the evidence of its outcome; a person approves anything that leaves the company. Owners run it through the Office team chat, the authority rules, the inbox, leads, decisions, the second brain and the agent modules, over Telegram, Zalo, Meta, Google and bank-transfer channels.

The conversion to the StarCi lite shape is the full architecture on one managed Supabase project: PostgreSQL through the `primary` connection, Auth and Storage through the Supabase integration, and background jobs on Supabase Queues (pgmq) in the same database. There is no test world and no end-to-end run for the front end; the back end has unit specs. The browser talks to the API over GraphQL with the user's access token (Apollo, SWR and axios for uploads); the only Supabase code in the web app is Auth (sign-in, session, token refresh), with no data reads. Privileged Auth and Storage operations and every provider webhook stay behind the API.

## Stack

TypeScript everywhere, NestJS in `be/`, Next.js with next-intl in `fe/`, Supabase for Auth, PostgreSQL and Queues, npm workspaces, and Turbo for front-end tasks. OpenClaw (the agent gateway) and n8n run next to the API on one VPS behind a Traefik edge; images are built from the repository root.

## Repository layout

- `be/`: the API and the command line, the shared platform capabilities, verified identity admission, the privileged Supabase integrations, the queues and the back-end documentation (`be/docs`).
- `fe/`: the web app; it reads and writes only through the API (`modules/api`: GraphQL queries and mutations behind `hooks/swr` wrappers, REST for uploads); Supabase is used for Auth alone.
- `supabase/`: local configuration, forward-only SQL migrations, seed data and the generated database types.
- `.starcistacks/`: value-free environment metadata and encrypted-secret custody only.
- `.starciwork/`: the lite workspace record (`workspace.yaml`) and the brand references.
- `scripts/`: the contract and type codegen (`codegen.mjs`).
- `deploy/swarm/`: the tools of the production Docker Swarm release (render, versioned secrets, convergence, verification, operator commands); the stack itself is `.starcistacks/production/infra/swarm/stack.yaml` (see `be/docs/runbooks/vps-stack.md` and `.starcistacks/production/README.md`).

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

The API reads `PORT`, `HTTP_SECURITY_ALLOWED_ORIGINS`, `PRIMARY_DB_URL`, `PRIMARY_DB_SCHEMA`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CHANNEL_TOKEN_KEY`, `SITE_URL` and `N8N_SIGNING_SECRET`; the queue tunables `QUEUE_ENABLED`, `QUEUE_CONCURRENCY`, `QUEUE_WORKSPACE_CONCURRENCY`, `QUEUE_POLL_INTERVAL`, `QUEUE_VISIBILITY_TIMEOUT`, `QUEUE_SHUTDOWN_GRACE`, `JOBS_LEASE` and `JOBS_WORKER_ID` are optional (`.starcistacks/production/infra/swarm/api.env.example` lists every name with required or optional). The web app reads `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL` (the origin of the API, `https://api.nivo.vn` in production), `NEXT_PUBLIC_DEVELOPER_API_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. A missing required key stops the process with the key's name; no template supplies credential defaults.

Secrets: the only custody is the sealed files `.starcistacks/<env>/secrets/<slug>.enc` (sops dotenv, age recipient in `.sops.yaml`; the age identity is `SOPS_AGE_KEY` in the StarCi runtime `.claude/secret.env`, which the owner backs up). There is no `.env` or `secrets.env`. A process receives a secret as `<NAME>_FILE=<path>` (the API's `EnvSource` reads the file first); a deploy decrypts each key in memory and creates a versioned Docker Swarm secret from it (`deploy/swarm/provision.mjs`), mounted at `/run/secrets/<NAME>`. Seal or read a value with `starci app secret set|show|list`.

Run it locally:

1. Start the local Supabase stack with `npm run db:start` (it applies the migrations and prints the local URL and the anon and service role keys). Local ports are the Supabase defaults plus 1000 so it runs next to other local stacks, and local email (invites, password reset) lands in its Inbucket mail catcher.
2. Export the API's required names in your shell (the local stack values; `PRIMARY_DB_URL` uses the `app_be` role of the local database) and run `npm run dev:be`. Run the web app with `NEXT_PUBLIC_*` exported the same way and `npm run dev:fe` (port 3000). Nothing writes a plaintext secrets file; for a one-off with production-shaped values materialize them into a private folder (`SOPS_AGE_KEY=... node deploy/materialize.mjs files --env production --out <dir>`) and delete it afterwards.

Images: `npm run docker:build` builds the API and command line images; the web image is `docker build -f fe/apps/web/Dockerfile .` from the root. Deploys are manual workflows, described with the cutover in `be/docs/runbooks/cutover.md`.

Guides and runbooks live in `be/docs`: `guides` for how the system works (jobs, second brain, connecting channels, adding an agent module) and `runbooks` for operating it (cutover, VPS stack, job operations, DNS at Tino, lite baseline, migration re-stamp map).

## Work

The workspace record and brand references live in `.starciwork/` (`workspace.yaml` and `brand/`).

## Accounts and sessions

Every person has their own sign-in (email and password, or Google) and a role in the workspace: `owner`, `manager` or `staff`. People join through an invite from the Team page; the invite link creates the account (or signs in) and accepts the membership. The account page shows the profile, password change and active sessions with per-session and "all other devices" sign-out. Invite emails go over SMTP (`SMTP_URL`); "Copy invite link" works without email.
