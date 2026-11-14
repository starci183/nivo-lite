# Cleaning production down to the kept workspaces

`cli cleanup-workspaces run` removes every workspace that is not kept, and every account that no kept workspace holds.
The owner uses it to keep the named production workspaces only. The command is permanent and has no undo, so
take the native backup (`starci app db dump`) and verify its receipt first.

## What it does

- `--keep <workspaceId,...>` is required. The command refuses an empty list, a malformed id, more than 20 ids, and any id that is
  not a workspace in the database.
- `--dry-run` deletes nothing. It prints one receipt line: the prefix from
  `be/src/modules/domain/workspace-cleanup/messages/workspace-cleanup.messages.ts`, then JSON with the receipt and its digest:
  - `keep`: the kept workspaces (id, name).
  - `remove`: each workspace to delete, with its row count per table that cascades from `public.workspaces` and their total.
    The counts come from `public.workspace_footprint(uuid)` (migration
    the workspace footprint migration (folded into the baseline)), a read-only `SECURITY INVOKER` function that only `app_be` may
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
  - A row the delete would cascade-delete (`app_commands.requested_by`) makes the dry run
    fail with the `KeptCascadeRefused` error, naming the users and the tables, unless `--allow-kept-cascade` is set.
    With the flag the receipt lists those rows, so they are part of the digest.
  - Keys that only clear the link (`connections.created_by` and the other `created_by` columns) are not counted.
- `--execute --receipt-digest <digest>` first runs a fresh dry run with the same checks. It goes on only when every keep id still
  exists and the fresh digest equals the reviewed one. A workspace, a row count or an account that changed since the review
  changes the digest, and then nothing is deleted. It deletes the workspaces first, through the prune of the workspaces owner
  (`WorkspacePruneService`), one by one, through the schema cascade. `platform_audit` and `app_errors` keep their rows with the
  workspace link cleared. Then it deletes the orphan accounts one at a time through the own-auth account doors
  (`IdentityAccountsService.deleteUser`). It never runs raw DELETE SQL and never resets the database.
- The first failed account delete stops the run. The command prints `FAILED account <id>: <reason>` and the receipt line with
  `deletedUsers` and `remainingUsers`, then exits with the `UserDeleteFailed` error. A re-run is safe: take a new dry
  run, which finds only what is left, and execute with its digest.

## Production run

Run it from the release tag through Actions > production cli tasks (`.github/workflows/cli-deploy.yml`) with task
`cleanup-workspaces`. The job runs the cli inside the running `nivo-api` task (`docker exec` through `starci app stack connect`):
deleting a workspace is the database cascade only: no agent gateway is involved since OpenClaw was removed (2026-11-11), so the
delete needs no gateway and has no `WORKSPACES_OPENCLAW_UNAVAILABLE` refusal any more; a workspace whose rows could not be removed
stays, and a re-run retries it.

1. Run with `keep` set to the kept workspace ids and `mode` set to `dry-run`. Leave `allow_kept_cascade` off unless a refusal
   named kept rows that may go with the account.
2. Review the receipt line in the job log: the kept workspace, every workspace to remove with its counts, and every orphan
   account. No kept workspace owner account may be in `orphanUsers`.
3. Run again with the same `keep` and `allow_kept_cascade`, `mode` set to `execute` and `receipt_digest` set to the reviewed
   digest.
4. Run a last dry run. It must show an empty `remove` and an empty `orphanUsers`.

## Local run

Against the local stack, build the cli app (`be/apps/cli`) and run it with the same two steps:

```bash
cli cleanup-workspaces run --keep <workspaceId> --dry-run
cli cleanup-workspaces run --keep <workspaceId> --execute --receipt-digest <digest>
```

The older `cli prune-workspaces run` deletes workspaces SOFTLY after a typed confirmation (owner ruling R36: it marks `workspaces.deleted_at`, removes no row, and leaves the accounts). Neither command hard-deletes a workspace any more: the schema has no cascade from `workspaces` and the application role has no DELETE on it. Use
`cleanup-workspaces` for a reviewed production cleanup.
