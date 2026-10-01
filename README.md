# nivo-lite

NIVO OS lite: a standalone Next.js 16 + Supabase app (split out of the StarCi monorepo).

- `src/app`, `src/features`, `src/lib`: the product (Office team chat, authority, inbox, leads, decisions, Telegram + simulated bank channels, per-person accounts and sessions).
- `src/ui`: the NIVO UI kit (vendored from the former `@nivo/ui` workspace package), built on `@starci/grammar` + HeroUI.
- `supabase/`: migrations and local config (`npm run db:start`). Local ports are the Supabase defaults + 1000 (API 55321, DB 55322, Studio 55323, Inbucket 55324, SMTP 55325) so it runs next to other local stacks.
- `docs/`: briefs, brand, UI rulebook and the operating-flow plan.

## Run locally
1. Copy `secrets.example.env` to `~/.nivo-lite/secrets.env` (override the path with `NIVO_SECRETS`) and fill it in. It is kept outside the repo. `scripts/set-secrets.ps1` sets the sensitive keys without echoing them.
2. `npm install`, `npm run db:start` (applies the migrations; copy the printed anon and service_role keys into the secrets file), `npm run dev` → http://localhost:3100
3. Local email (invites, password reset) lands in Inbucket: http://127.0.0.1:55324

## Accounts and sessions
- Every person has their own sign-in (email + password, or Google) and a role in the workspace: `owner`, `manager` or `staff`.
- There is no open sign-up (Supabase `enable_signup = false`: accounts are created by the server). People join through an invite from the Team page (`/team`); the invite link `/invite/<token>` creates the account (or signs in) and accepts the membership. `NIVO_ALLOW_WORKSPACE_SIGNUP=1` (local only) lets an existing user with no membership create their own workspace; the demo button needs `NEXT_PUBLIC_DEMO_LOGIN=1`.
- `/account`: profile, change password, active sessions with per-session and "all other devices" sign-out.
- Invite emails are sent over SMTP (`SMTP_URL`, locally Inbucket); "Copy invite link" works without email.

## Checks
`npx tsc --noEmit -p .`, `node scripts/policy-check.mjs`, `npm run build`, `npm run db:test` (RLS and membership rules against the local stack).
