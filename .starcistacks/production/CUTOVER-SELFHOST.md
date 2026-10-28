# Production cutover: Supabase cloud to self-hosted (lite)

Owner ruling 2026-10-29: Postgres on the VPS, our own auth (Passport: Google OAuth plus email/password, own JWT and JWKS), MinIO storage.
Rules: BE_AUTH_PASSPORT_OWNER, BE_AUTH_JWT_OWN_JWKS, BE_AUTH_REFRESH_COOKIE, BE_STORAGE_OWNER, LITE_DB_MIGRATION, LITE_DB_TYPES_FRESH.

Names marked `(confirm)` come from a sibling lane (sh-authbe, sh-storage, sh-db) that had not committed when this was written: read the final name from that lane's report or `runtime/env/KEYS.md` before sealing. Never paste a value into this file, a ticket or a log.

Why no SQL change is needed: the API connects as `app_be` through TypeORM raw SQL and never calls a function that reads `auth.uid()` or `auth.jwt()`. The roughly 40 such functions (`session_bootstrap`, `request_invite_command`, ...) are browser RPC for the retired supabase-js client (no `.rpc(` call remains in `fe/`), and the `app_be` policies are `workspace_id IS NOT NULL`, not `auth.uid()`. So migration 20261109000900 is not written. If a BE path ever starts to call one, add that migration then (set `request.jwt.claim.sub` from a session GUC).

DB env name: `DATABASE_URL`. `PRIMARY_DB_URL` is the legacy name the stack maps until sh-db renames it.

## 0. Preconditions (stop if any is false)
- The verified encrypted dump of 2026-10-28T22:33Z exists and passes sh-db's restore proof (`infra/swarm/recovery/restore-proof.md`).
- sh-db, sh-authbe, sh-authfe, sh-storage and sh-cutover are merged on main, CI is green, images are built from that sha.
- The owner holds the Google OAuth client id and secret and the VPS ssh session.

## 1. Freeze writes
1. Announce a maintenance window. The cloud project is already egress-locked; do not unlock it for this.
2. Scale the old api, web and workers to 0 on the VPS (`npx starci app stack` scale/remove verb; `starci explain` lists it). Confirm no replica runs.
3. If Supabase cloud is readable, take a final dump. If it stays locked, the 2026-10-28T22:33Z dump is the data of record and the loss window is declared to the owner.

## 2. Restore into nivo-postgres
Follow sh-db's runbook: decrypt the dump in memory, restore roles, schema, auth, storage schema and data into the `nivo-postgres` service. Check row counts of `auth.users`, `public.workspaces`, `public.workspace_members`.
Rollback of this step: drop the restored database; nothing else changed.

## 3. Run migrations
`npm run db:plan`, read it, then `npm run db:migrate` (both are `starci app db ... --db-url-env DATABASE_URL`).
Pending files after the baseline include sh-db's, sh-authbe's auth and refresh-token tables, and the additive 2026-11-09 files. Verify `db:plan` shows none pending. Never edit an applied file.

## 4. Seal the new secrets
With the D:/.claude CLI (hfs 4.9.11) `starci app secret ...`, into the members named in `runtime/env/KEYS.md`:
- database: `DATABASE_URL` (as `app_be`), the Postgres service password (confirm, sh-db);
- auth: JWT signing key pair (confirm), `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, refresh-cookie settings (confirm);
- storage: endpoint, access key, secret key, bucket (confirm, sh-storage), MinIO root credentials (confirm).

Keep the `SUPABASE_*` members sealed until the rollback window closes (step 11); then remove `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_*`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`.

## 5. Switch the environment
Point the primary DB env at `nivo-postgres` and set the auth and storage env of step 4 in `infra/swarm/stack.yaml` and `api.env.example` (sh-db, sh-authbe and sh-storage own their lines). Commit and push main.

## 6. Rebuild the web image without Supabase
The deploy workflow builds web with no `NEXT_PUBLIC_SUPABASE_URL` and no `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the `build fe web` env in `.github/workflows/ci.yml` must drop them; sh-authfe/sh-db own that edit if they have not). Check: the built `.next` output contains no `supabase.co`.

## 7. Deploy
`npx starci app stack deploy --env production --urgent --image api=<repo>@sha256:<digest> --image web=<repo>@sha256:<digest> --image landing=<repo>@sha256:<digest> --source-sha <sha>`
Dry run first with `stack render` (same flags). Wait until `converge` reports every task healthy.

## 8. Owner: Google OAuth redirect URI
In the Google Cloud Console, on the OAuth client, add the authorized redirect URI `https://api.nivo.vn/auth/google/callback` (confirm the final route with sh-authbe). Remove the Supabase callback URI only after the smoke tests pass. Only the owner does this.

## 9. Copy the storage objects
Run sh-storage's copy command (confirm its name) from the owner machine: it reads `storage.objects` from the restored database and copies each object from the dump of record (or Supabase cloud if unlocked) into MinIO, same bucket and path. Compare object count and total bytes per bucket; it must report zero mismatch.

## 10. Smoke tests
- JWKS endpoint returns keys (confirm path); `/healthz` is 200; the GraphQL typename probe is 200.
- Sign in with an existing email/password account (the restored bcrypt hash verifies) and with Google. A refresh rotates, and the old refresh token is refused. Logout clears the httpOnly cookie.
- Upload and view an avatar, a knowledge file and a content image; open an old object copied in step 9.
- Create a workspace, invite a member, open the dashboard.
- Chat typing and the job queue work (processor logs).

## 11. Rollback
Before step 10 is signed off:
1. Redeploy the previous release record with `stack deploy --env production --urgent` (images by digest; the Supabase members are still sealed, so the old secret names still exist).
2. Restore the old env (cloud DB URL, `SUPABASE_*`) and re-add the Supabase redirect URI in Google.
3. This works only when Supabase cloud is unlocked (the owner resets the egress quota or upgrades). While it is locked there is no rollback target: the forward fix is the only path and `nivo-postgres` is the source of truth.

Take `npm run db:dump -- --out <path outside the repo>` before step 7 and after step 10. Writes made on nivo-postgres after the cutover do not flow back to Supabase cloud; a rollback after real traffic loses them unless replayed by hand.
