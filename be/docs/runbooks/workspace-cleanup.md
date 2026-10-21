# Cleaning production down to the kept workspaces

`cli cleanup-workspaces run` removes every workspace that is not kept, and every Supabase Auth account that no kept workspace holds.
At the v0.3.0 production deploy the owner uses it to keep the HAKUEN workspace only. The command is permanent and has no undo, so
take the native backup (`starci app db dump`) and verify its receipt first.

## What it does

- `--keep <workspaceId,...>` is required. The command refuses an empty list, a malformed id, more than 20 ids, and any id that is
  not a workspace in the database.
- `--dry-run` deletes nothing. It prints one receipt line: the prefix from
  `be/src/modules/domain/workspace-cleanup/messages/workspace-cleanup.messages.ts`, then JSON with the receipt and its digest:
  - `keep`: the kept workspaces (id, name).
  - `remove`: each workspace to delete, with its row count per table that cascades from `public.workspaces` and their total.
    The counts come from `public.workspace_footprint(uuid)` (migration
    `supabase/migrations/20261101000907_workspace-footprint.sql`), a read-only `SECURITY INVOKER` function that only `app_be` may
    execute.
  - `orphanUsers`: each account no kept workspace holds as a member or owner, by id, with the email masked (`h***@gmail.com`)
    and `keptCascade`, the kept rows its delete would cascade-delete (empty unless `--allow-kept-cascade`).
  - `uncounted`: `job_outbox`. Its rows cascade from the workspace too and are deleted, but `app_be` holds no grant on that table,
    so the footprint cannot count them.
  - `allowKeptCascade`: whether `--allow-kept-cascade` was set, so the execute must use the same value.
  - `digest`: the sha256 of the canonical receipt JSON (keys sorted, lists sorted by id).
- The dry run also reads, for each orphan account, what its delete would do to the data that survives the cleanup (the kept
  workspaces and the rows of no workspace), through `public.workspace_user_references(uuid, uuid[])` in the same migration:
  - A row whose foreign key onto `auth.users` refuses the delete (`lead_actions.requested_by`) makes the dry run fail with
    the `UserReferenceBlocked` error, naming the users and the tables. Remove or reassign those rows, or make the person
    a member of a kept workspace, then run the dry run again.
  - A row the delete would cascade-delete (`app_commands.requested_by`, `hiring_availability.member_user_id`) makes the dry run
    fail with the `KeptCascadeRefused` error, naming the users and the tables, unless `--allow-kept-cascade` is set.
    With the flag the receipt lists those rows, so they are part of the digest.
  - Keys that only clear the link (`connections.created_by` and the other `created_by` columns) are not counted.
- `--execute --receipt-digest <digest>` first runs a fresh dry run with the same checks. It goes on only when every keep id still
  exists and the fresh digest equals the reviewed one. A workspace, a row count or an account that changed since the review
  changes the digest, and then nothing is deleted. It deletes the workspaces first, through the prune of the workspaces owner
  (`WorkspacePruneService`), one by one, through the schema cascade. `platform_audit` and `app_errors` keep their rows with the
  workspace link cleared. Then it deletes the orphan accounts one at a time through Supabase Auth
  (`SupabaseAccountsService.deleteUser`). It never runs raw DELETE SQL and never resets the database.
- The first failed account delete stops the run. The command prints `FAILED account <id>: <reason>` and the receipt line with
  `deletedUsers` and `remainingUsers`, then exits with the `UserDeleteFailed` error. A re-run is safe: take a new dry
  run, which finds only what is left, and execute with its digest.

## Production run

Run it from the release tag through Actions > seed demo workspace (`.github/workflows/cli-deploy.yml`) with task
`cleanup-workspaces`. The job reads the same sealed custody as the seed job: every key reaches the cli as `<KEY>_FILE` and is never
echoed. It requires `PRIMARY_DB_URL`, `SUPABASE_URL` and `CHANNEL_TOKEN_KEY`.

1. Run with `keep` set to the HAKUEN workspace id and `mode` set to `dry-run`. Leave `allow_kept_cascade` off unless a refusal
   named kept rows that may go with the account.
2. Review the receipt line in the job log: the kept workspace, every workspace to remove with its counts, and every orphan
   account. The HAKUEN owner account must not be in `orphanUsers`.
3. Run again with the same `keep` and `allow_kept_cascade`, `mode` set to `execute` and `receipt_digest` set to the reviewed
   digest.
4. Run a last dry run. It must show an empty `remove` and an empty `orphanUsers`.

Then seed HAKUEN with task `seed-workspace` (profile `hakuen`).

## Local run

Against the local stack, build the cli app (`be/apps/cli`) and run it with the same two steps:

```bash
cli cleanup-workspaces run --keep <workspaceId> --dry-run
cli cleanup-workspaces run --keep <workspaceId> --execute --receipt-digest <digest>
```

The older `cli prune-workspaces run` deletes workspaces after a typed confirmation and leaves the accounts. Use
`cleanup-workspaces` for a reviewed production cleanup.
