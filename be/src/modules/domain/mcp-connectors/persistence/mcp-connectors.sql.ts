import { sql } from "@modules/platform/database"

/** The connector rows of a workspace, by key ($1 workspace); native rows only toggle a status and a time limit. */
export const LIST_CONNECTORS = sql`
    SELECT key, name, kind, url, credential_ref, status, contract_version, timeout_ms, tool_catalog, catalog_hash,
           approved_catalog, to_json(approved_at) #>> '{}' AS approved_at, to_json(checked_at) #>> '{}' AS checked_at
    FROM public.mcp_connectors
    WHERE workspace_id = $1
    ORDER BY key
    LIMIT 200`

/** Registers or updates a remote connector; the catalog is kept until the next read ($1 workspace to $7 time limit). */
export const UPSERT_REMOTE_CONNECTOR = sql`
    INSERT INTO public.mcp_connectors (workspace_id, key, name, kind, url, credential_ref, contract_version, timeout_ms)
    VALUES ($1, $2, $3, 'remote', $4, $5, $6, $7)
    ON CONFLICT (workspace_id, key) DO UPDATE
    SET name = EXCLUDED.name, url = EXCLUDED.url, credential_ref = EXCLUDED.credential_ref,
        contract_version = EXCLUDED.contract_version, timeout_ms = EXCLUDED.timeout_ms, updated_at = now()`

/** Stores the live catalog snapshot of a connector, its status and the check time ($1 workspace, $2 key, $3 catalog, $4 hash, $5 status). */
export const UPDATE_CATALOG = sql`
    UPDATE public.mcp_connectors
    SET tool_catalog = $3::jsonb, catalog_hash = $4, status = $5, checked_at = now(), updated_at = now()
    WHERE workspace_id = $1 AND key = $2`

/**
 * Approves the live catalog of a remote connector, only while it is still the snapshot the approval was made on ($1 workspace,
 * $2 key, $3 approved pairs, $4 catalog hash, $5 person). Answers the key when it approved.
 */
export const APPROVE_CATALOG = sql`
    WITH approved AS (
        UPDATE public.mcp_connectors
        SET approved_catalog = $3::jsonb, approved_by = $5, approved_at = now(), updated_at = now()
        WHERE workspace_id = $1 AND key = $2 AND kind = 'remote' AND catalog_hash = $4
        RETURNING key
    )
    SELECT key FROM approved`

/** Records one health check of a connector: its status and when ($1 workspace, $2 key, $3 status). */
export const RECORD_HEALTH = sql`
    UPDATE public.mcp_connectors
    SET status = $3, checked_at = now(), updated_at = now()
    WHERE workspace_id = $1 AND key = $2 AND status <> 'disabled'`
