import { sql } from "@modules/platform/database"

/** The connector rows of a workspace, by key ($1 workspace); native rows only toggle a status and a time limit. Never the sealed credential. */
export const LIST_CONNECTORS = sql`
    SELECT key, name, kind, url, credential_state, to_json(credential_set_at) #>> '{}' AS credential_set_at, status,
           contract_version, timeout_ms, tool_catalog, catalog_hash, approved_catalog,
           to_json(approved_at) #>> '{}' AS approved_at, to_json(checked_at) #>> '{}' AS checked_at
    FROM public.mcp_connectors
    WHERE workspace_id = $1
    ORDER BY key
    LIMIT 200`

/**
 * Registers or updates a remote connector; the catalog is kept until the next read and a stored credential is kept ($1 workspace,
 * $2 key, $3 name, $4 url, $5 true when the server takes a credential, $6 contract, $7 time limit). A connector that took none and
 * now takes one becomes `needed`; this statement never writes a credential.
 */
export const UPSERT_REMOTE_CONNECTOR = sql`
    INSERT INTO public.mcp_connectors (workspace_id, key, name, kind, url, credential_state, contract_version, timeout_ms)
    VALUES ($1, $2, $3, 'remote', $4, CASE WHEN $5::boolean THEN 'needed' ELSE 'none' END, $6, $7)
    ON CONFLICT (workspace_id, key) DO UPDATE
    SET name = EXCLUDED.name, url = EXCLUDED.url,
        credential_state = CASE
            WHEN public.mcp_connectors.credential_state = 'none' AND EXCLUDED.credential_state = 'needed' THEN 'needed'
            ELSE public.mcp_connectors.credential_state
        END,
        contract_version = EXCLUDED.contract_version, timeout_ms = EXCLUDED.timeout_ms, updated_at = now()`

/**
 * Stores the sealed credential of a remote connector, replacing the one it had ($1 workspace, $2 key, $3 sealed text, $4 person).
 * Answers the key when a remote connector of that key was written.
 */
export const SET_CREDENTIAL = sql`
    WITH written AS (
        UPDATE public.mcp_connectors
        SET credential_state = 'set', credential_sealed = $3, credential_set_by = $4, credential_set_at = now(),
            updated_at = now()
        WHERE workspace_id = $1 AND key = $2 AND kind = 'remote'
        RETURNING key
    )
    SELECT key FROM written`

/** The sealed credential of one remote connector, for the gateway to open before it calls the server ($1 workspace, $2 key). */
export const FIND_SEALED_CREDENTIAL = sql`
    SELECT credential_state, credential_sealed
    FROM public.mcp_connectors
    WHERE workspace_id = $1 AND key = $2 AND kind = 'remote'
    LIMIT 1`

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

/** One sealed connector credential, any, to prove at boot that the connection key still opens what it sealed (no parameter). */
export const SAMPLE_SEALED_CREDENTIAL = sql`
    SELECT credential_sealed
    FROM public.mcp_connectors
    WHERE credential_sealed IS NOT NULL
    LIMIT 1`
