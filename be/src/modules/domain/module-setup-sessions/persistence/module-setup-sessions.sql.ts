import { sql } from "@modules/platform/database"

/** The newest revision of an installation. */
export const FIND_LATEST_SESSION = sql`
    SELECT id, workspace_id AS "workspaceId", installation_id AS "installationId", revision, status,
           draft_snapshot AS draft, gate_evidence AS "gateEvidence", to_json(created_at) #>> '{}' AS "createdAt"
    FROM public.module_setup_sessions
    WHERE installation_id = $1
    ORDER BY revision DESC
    LIMIT 1`

/** One session of the workspace by id. */
export const FIND_SESSION = sql`
    SELECT id, workspace_id AS "workspaceId", installation_id AS "installationId", revision, status,
           draft_snapshot AS draft, gate_evidence AS "gateEvidence", to_json(created_at) #>> '{}' AS "createdAt"
    FROM public.module_setup_sessions
    WHERE id = $1 AND workspace_id = $2
    LIMIT 1`

/** Every revision of an installation, oldest first. */
export const LIST_REVISIONS = sql`
    SELECT id, revision, status
    FROM public.module_setup_sessions
    WHERE installation_id = $1
    ORDER BY revision ASC
    LIMIT 100`

/** Opens a draft ($1 workspace, $2 installation, $3 revision, $4 draft JSON, $5 gate evidence JSON). */
export const INSERT_SESSION = sql`
    INSERT INTO public.module_setup_sessions (workspace_id, installation_id, revision, draft_snapshot, gate_evidence)
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
    RETURNING id, workspace_id AS "workspaceId", installation_id AS "installationId", revision, status,
              draft_snapshot AS draft, gate_evidence AS "gateEvidence", to_json(created_at) #>> '{}' AS "createdAt"`

/** Stores what a turn produced on the open draft ($1 id, $2 draft JSON, $3 gate evidence JSON). */
export const SAVE_TURN = sql`
    WITH changed AS (
        UPDATE public.module_setup_sessions
        SET draft_snapshot = $2::jsonb, gate_evidence = $3::jsonb
        WHERE id = $1 AND status = 'draft'
        RETURNING id, workspace_id, installation_id, revision, status, draft_snapshot, gate_evidence, created_at)
    SELECT id, workspace_id AS "workspaceId", installation_id AS "installationId", revision, status,
           draft_snapshot AS draft, gate_evidence AS "gateEvidence", to_json(created_at) #>> '{}' AS "createdAt"
    FROM changed`

/** Closes a draft as applied ($1 id). */
export const CLOSE_SESSION = sql`
    WITH changed AS (
        UPDATE public.module_setup_sessions
        SET status = 'applied'
        WHERE id = $1
        RETURNING id)
    SELECT id FROM changed`
