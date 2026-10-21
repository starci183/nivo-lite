# nivo-lite

<!-- >>> starci app sync (managed block; do not edit) >>> -->

[![CI](https://github.com/starci183/nivo-lite/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/starci183/nivo-lite/actions/workflows/ci.yml)
[![Codecov](https://codecov.io/gh/starci183/nivo-lite/branch/main/graph/badge.svg)](https://codecov.io/gh/starci183/nivo-lite)
[![Quality Gate](https://sonar.starci.org/api/project_badges/measure?project=nivo-lite&metric=alert_status)](https://sonar.starci.org/dashboard?id=nivo-lite)
[![Dependabot](https://github.com/starci183/nivo-lite/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/starci183/nivo-lite/actions/workflows/dependabot/dependabot-updates)

<!-- <<< starci app sync <<< -->

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
- `.starciwork/`: the lite workspace record (`.starciwork/workspace.yaml`) and the brand references.
- `scripts/`: the contract and type codegen (`scripts/codegen.mjs`).
- The production Docker Swarm release is driven by the canon `starci app stack` verbs (render, versioned secrets, convergence, verification, operator commands); the stack itself is `.starcistacks/production/infra/swarm/stack.yaml` (see `be/docs/runbooks/vps-stack.md` and `.starcistacks/production/README.md`).

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

Local development uses Supabase CLI-managed Docker containers for PostgreSQL, Auth and Storage. The API, web console and landing run separately and need their own runtime or build configuration. The [development runbook](.starcistacks/dev/README.md) owns the required local API settings, custody boundaries and startup procedure; the API's typed readers and the front-end configuration modules validate their respective inputs.

Application secret custody uses sealed files `.starcistacks/<env>/secrets/<slug>.enc` (SOPS dotenv, age recipient in `.sops.yaml`; the matching identity stays with the StarCi runtime owner). The API accepts `<NAME>_FILE=<path>` through `EnvSource`; Swarm deployments mount versioned Docker secrets at `/run/secrets/<NAME>`. Manage sealed custody through `starci app secret`. The development runbook explains the current recipe's legacy configuration input; it does not use production custody as a local fallback.

Follow that runbook before starting the local application processes. A running Supabase stack establishes dependency startup; application configuration, database readiness and browser behavior still need their own verification.

Images: `npm run docker:build` builds the API and command line images; the web image is `docker build -f fe/apps/web/Dockerfile .` from the root. Deploys are manual workflows, described with the cutover in `be/docs/runbooks/cutover.md`.

### Native FFmpeg setup

Video rendering needs owner-installed FFmpeg and FFprobe. Fixed defaults are `/usr/bin/ffmpeg` and `/usr/bin/ffprobe` on Linux (including the API image), `/opt/homebrew/bin` on Apple Silicon macOS, `/usr/local/bin` on Intel macOS, and `C:/Program Files/ffmpeg/bin/ffmpeg.exe` plus `ffprobe.exe` on Windows. Install into these locations or supply `VIDEO_FFMPEG_PATH` and `VIDEO_FFPROBE_PATH` as absolute local executable paths before `npm run dev:be:api`; spaces are supported without shell quoting inside the values. Executables and their parent directories must be controlled by the trusted operator, with no write access for untrusted users. The integration never searches PATH.

`VIDEO_FFMPEG_NICE` defaults to true on Linux and false elsewhere. Priority lowering uses `/bin/nice` on Linux and `/usr/bin/nice` on macOS; `VIDEO_NICE_PATH` selects another trusted absolute executable. Enabling it on Windows requires an explicit compatible nice executable. Relative paths and Windows network shares are rejected; unavailable executables fail the rendering call visibly.

Guides and runbooks live in `be/docs`: `guides` for how the system works (jobs, second brain, connecting channels, adding an agent module) and `runbooks` for operating it (cutover, VPS stack, job operations, DNS at Tino, lite baseline, migration re-stamp map).

## Work

The workspace record and brand references live in `.starciwork/` (`.starciwork/workspace.yaml` and `.starciwork/brand`).

## Accounts and sessions

Every person has their own sign-in (email and password, or Google) and a role in the workspace: `owner`, `manager` or `staff`. People join through an invite from the Team page; the invite link creates the account (or signs in) and accepts the membership. The account page shows the profile, password change and active sessions with per-session and "all other devices" sign-out. Invite emails go over SMTP (`SMTP_URL`); "Copy invite link" works without email.
