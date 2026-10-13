import { sql } from "@modules/platform/database"

/** The cards of the given sessions, oldest first, without the superseded ones. */
export const LIST_CARDS = sql`
    SELECT id, workspace_id AS "workspaceId", setup_session_id AS "setupSessionId", source_message_id AS "sourceMessageId",
           gate_key AS "gateKey", kind, target_key AS "targetKey", payload, status, result, decided_by AS "decidedBy",
           to_json(created_at) #>> '{}' AS "createdAt"
    FROM public.module_setup_writes
    WHERE setup_session_id = ANY($1::uuid[]) AND status <> 'superseded'
    ORDER BY created_at ASC, id ASC
    LIMIT 500`

/** One card of the workspace by id. */
export const FIND_CARD = sql`
    SELECT id, workspace_id AS "workspaceId", setup_session_id AS "setupSessionId", source_message_id AS "sourceMessageId",
           gate_key AS "gateKey", kind, target_key AS "targetKey", payload, status, result, decided_by AS "decidedBy",
           to_json(created_at) #>> '{}' AS "createdAt"
    FROM public.module_setup_writes
    WHERE id = $1 AND workspace_id = $2
    LIMIT 1`

/** Marks the waiting cards of the given targets as superseded ($1 session, $2 targets). */
export const SUPERSEDE_CARDS = sql`
    UPDATE public.module_setup_writes
    SET status = 'superseded'
    WHERE setup_session_id = $1 AND target_key = ANY($2::text[]) AND status = 'proposed'`

/** Stores the cards of a turn ($1 workspace, $2 session, $3 source message, $4 cards JSON). */
export const INSERT_CARDS = sql`
    INSERT INTO public.module_setup_writes (workspace_id, setup_session_id, source_message_id, gate_key, kind, target_key, payload)
    SELECT $1, $2, $3, c.gate_key, c.kind, c.target_key, c.payload
    FROM jsonb_to_recordset($4::jsonb) AS c(gate_key text, kind text, target_key text, payload jsonb)`

/** Closes a waiting card; a card decided already is left alone ($1 id, $2 workspace, $3 status, $4 payload, $5 result, $6 decided by). */
export const CLOSE_CARD = sql`
    WITH changed AS (
        UPDATE public.module_setup_writes
        SET status = $3, payload = $4::jsonb, result = $5::jsonb, decided_by = $6, decided_at = now()
        WHERE id = $1 AND workspace_id = $2 AND status = 'proposed'
        RETURNING id, workspace_id, setup_session_id, source_message_id, gate_key, kind, target_key, payload, status, result,
                  decided_by, created_at)
    SELECT id, workspace_id AS "workspaceId", setup_session_id AS "setupSessionId", source_message_id AS "sourceMessageId",
           gate_key AS "gateKey", kind, target_key AS "targetKey", payload, status, result, decided_by AS "decidedBy",
           to_json(created_at) #>> '{}' AS "createdAt"
    FROM changed`
