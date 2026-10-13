# Cutover: from the engine and Next route handlers to the api

This is the runbook for the day `lite/convert` becomes `main`. Until then production keeps deploying `main` (the engine, the Next route handlers, Netlify as the fallback)
and nothing in the conversion branch deploys by itself: the three deploy workflows (`api-deploy.yml`, `edge-deploy.yml`, `web-deploy.yml`) have no push trigger and run by hand only.

What changes in production:

| Before                                                                           | After                                                                                                           |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `engine` container in OpenClaw's network namespace (port 8787), built on the VPS | `api` container (`be/apps/api`) in the same place and on the same port, image built on the GitHub runner        |
| webhooks, OAuth callbacks and `/api/*` served by Next route handlers             | the same public paths served by the api; the edge sends every `/api/` path of the product hosts to it           |
| the browser talks to Supabase and to Next server actions                         | the browser talks to Supabase under RLS and to `https://api.nivo.vn` with the user's access token               |
| the service role in Next and in the engine                                       | the service role only in the api (Auth and Storage admin); database access as the least-privilege role `app_be` |
| Netlify as a hot fallback                                                        | retired (its last good deploy stays available for a DNS rollback)                                               |

## Order and why

Deploy in this order: **database, then api, then edge, then web**, back to back (the whole sequence takes 15 to 20 minutes).

The plan named edge, api, web. The order here swaps the first two on purpose: the edge sends `/api/` paths to the api at 8787. If the edge goes first, that address still
holds the engine, which answers 404 to every provider webhook (Telegram, Meta, SePay, Casso, payOS) until the api is up; providers retry, but a customer message can be late. With the api first,
the old Next handlers keep answering the webhooks until the edge flips them, and after the flip the api answers. The only thing that is briefly unserved with the api first is the old chat
queue (`engine_jobs`, which only the engine consumed): chat turns fall back to the direct processor for the minutes between the api and the web deploy, which the apps already do when the
engine heartbeat is older than 90 seconds. If you still prefer edge first, it works with the 404 window above.

## 0. Preconditions (days before)

- [ ] All lanes are merged into `lite/convert`; `starci app check` reports no finding that blocks the release, `npm run typecheck`, `npm test`, `npm run build:be`, `npm run build:fe` pass.
- [ ] The api image builds: `docker build -f be/apps/api/Dockerfile -t nivo-lite/api:dev .` and starts with a real `api.env` (a missing key stops it with the key's name).
- [ ] The web image builds: `docker build -f fe/apps/web/Dockerfile -t nivo-lite/web:dev --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... .`
- [ ] The hosted Supabase project signs access tokens with an **asymmetric key (ES256)**: `curl -fsS "$SUPABASE_URL/auth/v1/.well-known/jwks.json"` lists an EC key. The api verifies tokens against this JWKS and pins ES256; with only the legacy shared secret, every authenticated call is refused. Enable the JWT signing keys in the dashboard first and let the old tokens expire.
- [ ] A backup of the database exists (Supabase point-in-time recovery enabled, or `pg_dump` taken now) and its restore is understood.
- [ ] `secrets.env` has the new `[stack]` and `[api]` blocks (template: `.starcistacks/production/README.md`) and `node scripts/env-sync.mjs --check` reports no missing names.
- [ ] DNS: an A record `api.nivo.vn` pointing at the VPS (DNS only, TTL 60), added in Cloudflare. The edge gets its certificate on the first request.
- [ ] Netlify: **stop auto publishing** on the site (Site configuration > Build & deploy) so the merge does not publish a Next build there. Do not delete the site; its last good deploy is a rollback target.
- [ ] Tag the current `main` so every rollback has a fixed point: `git tag pre-lite-cutover origin/main && git push origin pre-lite-cutover` (an owner action).
- [ ] Run `git diff --stat origin/main...lite/convert -- supabase/migrations` and read it: the migrations are forward-only, and the old app must keep working against the new schema until the web is deployed.

## 1. Database

1. Link the CLI to the production project (`supabase link --project-ref <ref>`, or use the database workflow with the `production` environment, which carries `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_ID`).
2. Repair the migration history. The conversion renamed every migration file and re-stamped the ones dated after 2026-10-12; production recorded the OLD versions. The map is `be/docs/runbooks/migration-restamp.md`
   (it is the source of truth, including any later re-stamp). For every row whose version changed:

   ```bash
   awk -F'|' '$4 ~ /->/ {gsub(/ /,"",$4); split($4,v,"->"); print v[1], v[2]}' be/docs/runbooks/migration-restamp.md |
   while read -r old new; do
     supabase migration repair --status reverted "$old"
     supabase migration repair --status applied "$new"
   done
   supabase migration list      # local and remote columns must now match for every pre-conversion migration
   ```

   Rows where only the name changed need nothing: the version is the key.

3. Apply the conversion migrations, which now live in `supabase/migrations/_archive/` (the lite baseline replaced them in `supabase/migrations/`, owner ruling 2026-10-13). Push them from a scratch
   project folder so the CLI sees them as migrations:

   ```bash
   mkdir -p ../nivo-archive/supabase/migrations && cp supabase/config.toml ../nivo-archive/supabase/ && cp supabase/migrations/_archive/*.sql ../nivo-archive/supabase/migrations/
   (cd ../nivo-archive && supabase link --project-ref <ref> && supabase db push --dry-run && supabase db push)
   ```

   This applies `be-platform` (the `app_be` role, `public.queue`, `public.jobs`, grants) and every lane migration.

4. Switch the history to the baseline. Production now holds exactly the schema of `supabase/migrations/<stamp>_lite-baseline.sql`, so it is marked applied without a run, and the archived versions leave the history:

   ```bash
   for f in supabase/migrations/_archive/*.sql; do supabase migration repair --status reverted "$(basename "$f" | cut -d_ -f1)"; done
   supabase migration repair --status applied "$(ls supabase/migrations/*_lite-baseline.sql | xargs -n1 basename | cut -d_ -f1)"
   supabase db push --dry-run    # lists only <stamp>_lite-baseline-standard.sql (and later migrations)
   supabase db push
   ```

   `lite-baseline-standard` brings the privileges and policy names of a database built by the archived migrations to the baseline's standard (anon holds no table privilege, definer functions are not callable by anon, policies named `<table>_<role>_<action>`); on a database built from the baseline it changes nothing.

   The local stack follows the same two steps (or `supabase db reset`).

5. Set the password of the api's database role once, in the SQL editor (never in a migration): `alter role app_be password '<generated>';`. Build `PRIMARY_DB_URL` from the dashboard's **Connect** panel
   (use the session-mode pooler or the direct connection; the api keeps a connection pool, so not the transaction-mode pooler) with user `app_be` (`app_be.<project-ref>` on the pooler) and put it in `[api]` of `secrets.env`.
6. Check the grants the api needs: connect as `app_be` (`psql "$PRIMARY_DB_URL" -c 'select count(*) from public.queue'`) and call one read of each table family a lane declared.
7. Drain the legacy queues you are about to stop consuming: `select status, count(*) from engine_jobs group by 1;` should show nothing `queued` or `running`, and `select public.job_stats();` should show an empty or small `knowledge` queue.

## 2. Secrets

```bash
node scripts/env-sync.mjs --check      # counts and missing names, nothing is pushed
node scripts/env-sync.mjs              # pushes ENGINE_ENV (stack), API_ENV (api runtime), WEB_ENV (public values) and the web build args to the "production" environment
```

Also set the GitHub variable `NEXT_PUBLIC_DEVELOPER_API_URL=https://api.nivo.vn` in the `production` environment (the default is the same). `ENGINE_SHARED_SECRET` is no longer used; leave it until the engine is gone.
Do not seal production secrets into the repository: `.starcistacks` stays value-free for now.

## 3. Merge

Merge `lite/convert` into `main` (owner action). Nothing deploys: the deploy workflows are manual, `images.yml` and `ci.yml` run on tags and by hand. Confirm in the Actions tab that no run started.

## 4. Deploy the api

Actions > **Deploy api** > Run workflow (branch `main`). It builds the image, ships it, swaps the release folder, replaces the `engine` container with `api` (`--remove-orphans`), waits for `healthy` and `/readyz`, and restores the previous release when that fails.

Verify on the VPS and from outside:

```bash
ssh vps 'cd ~/nivo-engine/deploy && docker compose --env-file .env ps && docker compose --env-file .env logs --tail 50 api'
ssh vps "docker exec nivo-engine-api-1 node -e \"fetch('http://127.0.0.1:'+process.env.PORT+'/readyz').then(r=>console.log(r.status))\""
curl -fsS https://engine.nivo.vn/healthz        # the legacy health host now answers from the api (the edge already routes it to 8787)
```

The watchdog line in the `nivo` crontab is rewritten by the workflow; `~/nivo-engine/watchdog.log` should show no `ALERT`.

## 5. Deploy the edge

Actions > **Deploy edge** > Run workflow. Traefik reloads the routes: `api.nivo.vn` and every `/api/` path of `nivo.vn`, `www.nivo.vn` and `app-vps.nivo.vn` go to the api; everything else still goes to the web container.

```bash
curl -fsS https://api.nivo.vn/health/live
curl -sS -o /dev/null -w '%{http_code}\n' https://nivo.vn/api/v1/events      # 401 or 405 from the api (JSON), not a Next 404 page
```

Provider webhooks keep their public paths, so nothing is changed in the provider dashboards. Spot-check Telegram: `curl -s "https://api.telegram.org/bot<token>/getWebhookInfo"` shows no `last_error_message` and `pending_update_count` falling to 0.

## 6. Deploy the web

Actions > **Deploy web** > Run workflow. It builds `fe/apps/web/Dockerfile` from the repository root, ships the image, starts it as `nivo-web:<sha>`, and rolls back to the previous tag when the container is not healthy.
Then walk the product once: sign in, `/dashboard`, `/inbox` (send a Telegram test message and see it arrive), `/billing` (a SePay test transfer), `/agents`, `/knowledge` (upload a small document and watch it become `ready`), `/connections` (a Google or Meta authorisation round trip), the public booking page `/b/<slug>`.

## 7. Verify the system

- `select public.job_stats();` shows a moving queue, `failed24h` stays small, no `ALERT` in `~/nivo-engine/watchdog.log`.
- `docker compose --env-file .env logs --since 10m api` has no repeating error; the OpenClaw turn path works (a customer message gets an answer through OpenClaw, not `direct_fallback`).
- n8n events still arrive (`N8N_DEFAULT_WEBHOOK_URL` is the compose-internal URL).
- Rate limiting is per client, not per proxy: two different clients both get 200 on a burst of requests that would exceed the limit for one address.
- Watch for an hour, then enable the nightly backup (`be/docs/runbooks/vps-stack.md`, Backup).

## Rollback

Decide quickly: after step 4 the old web is still live, after step 5 only the `/api/` paths moved, after step 6 everything moved. Roll back in the reverse order. Every rollback runs the OLD workflow from the tag
`pre-lite-cutover` (Run workflow > "Use workflow from" > tag), because the old workflows build the old code.

1. **Web**: Run **Deploy web** from the tag `pre-lite-cutover` (rebuilds the pre-conversion image), or start the previous image that is still on the host: `ssh vps 'bash ~/nivo-web/remote-deploy.sh "$(cat ~/nivo-web/.tag.prev)"'`.
2. **Edge**: Run **Deploy edge** from the tag; the old routes send `/api/` back to the web container and keep `engine.nivo.vn/healthz` on the engine.
3. **Engine**: Run **Deploy engine** from the tag. It rebuilds the engine on the VPS and replaces the `api` container (the stack project is the same, so the volumes are untouched). `~/nivo-engine.prev` holds the previous release folder if a manual start is quicker.
4. **Database**: do not roll the schema back. Migrations are forward-only and the old code is expected to run against the new schema; if a specific migration breaks the old code, fix it with a new forward migration. The one reversible part is the history repair: if you must
   return to the old file names, repeat the loop of step 1.2 with `reverted` on the new version and `applied` on the old one.
5. **DNS** (only if the VPS itself is lost): `node scripts/with-secrets.mjs node deploy/stack/dns-rollback.mjs` puts the apex back on Netlify (`be/docs/runbooks/dns-rollback.md`); in Netlify use "Publish deploy" on the last pre-cutover deploy, because the site builds nothing after auto publishing was stopped.

## After the cutover

- Restore push triggers on the deploy workflows only if you want deploys on merge again (they were removed so the conversion deploys nothing by itself).
- Retire the engine: its source left the tree with the lite cleanup (the `pre-lite-cutover` tag keeps it). Once nothing consumes `engine_jobs` and a week has passed, delete the secret `ENGINE_SHARED_SECRET` and the `engine_*` rows and RPCs in a forward migration.
- Retire Netlify: delete `netlify.toml` (already removed from the tree), then the Netlify site and its build hook.
- Remove the `[engine]` alias block from `secrets.env` and the legacy `ENGINE_BIND` from the stack env once `API_BIND` is set.
- Update the provider-facing guide only if a public path changed (`be/docs/guides/connecting-channels.md`).

## Known gaps handed to the integrator

- `fe/apps/web/next.config.ts` still sets `output: "standalone"` only when `NEXT_OUTPUT=standalone` (the Dockerfile sets it); the web lane should make it unconditional and pin `outputFileTracingRoot`.
- The web healthcheck probes `/login`; switch it to `/health/live` once the web lane adds that route.
- The root `package.json` has `docker:build:api` and `docker:build:cli` but no `docker:build:web` (a managed script block; `starci app sync` owns it).
- Operator scripts `deploy/stack/jobs.sh` and the job check in `watchdog.sh` read `job_stats()` and `job_outbox`; repoint them to the cli commands of the queue lane once those exist.
