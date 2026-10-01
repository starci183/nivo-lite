# nivo-lite

NIVO OS lite: a standalone Next.js 16 + Supabase app (split out of the StarCi monorepo `apps/prototype`).

- `src/app`, `src/features`, `src/lib`: the product (Office team chat, authority, inbox, leads, decisions, Telegram + simulated bank channels).
- `src/ui`: the NIVO UI kit (vendored from the former `@nivo/ui` workspace package), built on `@starci/grammar` + HeroUI.
- `supabase/`: migrations and local config (`npm run db:start`).

## Run locally
1. Copy `secrets.example.env` to `~/.nivo-prototype/secrets.env` and fill it in (kept outside the repo).
2. `npm install`, `npm run db:start`, `npm run dev` → http://localhost:3090
