import { sql } from "@modules/platform/database"

/** The record the next sync compares with ($1 installation). */
export const FIND_SYNC_STATE = sql`SELECT content_hash, status FROM public.openclaw_agent_sync WHERE installation_id = $1 LIMIT 1`

/** Records a sync that rewrote the files: the synced and checked times both move ($1 installation, $2 workspace, $3 agent, $4 at, $5 context version, $6 hash, $7 files JSON). */
export const RECORD_SYNC_WRITTEN = sql`INSERT INTO public.openclaw_agent_sync (installation_id, workspace_id, agent_id, checked_at, synced_at, status, error, context_version, content_hash, files)
VALUES ($1, $2, $3, $4, $4, 'ok', NULL, $5, $6, $7::jsonb)
ON CONFLICT (installation_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id, agent_id = EXCLUDED.agent_id, checked_at = EXCLUDED.checked_at,
    synced_at = EXCLUDED.synced_at, status = 'ok', error = NULL, context_version = EXCLUDED.context_version,
    content_hash = EXCLUDED.content_hash, files = EXCLUDED.files`

/** Records a sync that found the copy current: only the checked time moves ($1 installation, $2 workspace, $3 agent, $4 at, $5 context version, $6 hash, $7 files JSON). */
export const RECORD_SYNC_CHECKED = sql`INSERT INTO public.openclaw_agent_sync (installation_id, workspace_id, agent_id, checked_at, status, error, context_version, content_hash, files)
VALUES ($1, $2, $3, $4, 'ok', NULL, $5, $6, $7::jsonb)
ON CONFLICT (installation_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id, agent_id = EXCLUDED.agent_id, checked_at = EXCLUDED.checked_at,
    status = 'ok', error = NULL, context_version = EXCLUDED.context_version, content_hash = EXCLUDED.content_hash, files = EXCLUDED.files`

/** Records a failed sync ($1 installation, $2 workspace, $3 agent, $4 at, $5 error). */
export const RECORD_SYNC_FAILED = sql`INSERT INTO public.openclaw_agent_sync (installation_id, workspace_id, agent_id, checked_at, status, error)
VALUES ($1, $2, $3, $4, 'error', $5)
ON CONFLICT (installation_id) DO UPDATE SET checked_at = EXCLUDED.checked_at, status = 'error', error = EXCLUDED.error`
