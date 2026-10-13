import { sql } from "@modules/platform/database"

/** One message of the workspace, to read who wrote it and what it says. */
export const FIND_MESSAGE = sql`
    SELECT m.id, m.author_kind, m.body
    FROM public.messages m
    WHERE m.workspace_id = $1 AND m.id = $2
    LIMIT 1`

/** The active agents of the workspace with these handles. */
export const LIST_AGENTS_BY_HANDLE = sql`
    SELECT a.id, a.handle, a.module, a.name
    FROM public.agents a
    WHERE a.workspace_id = $1 AND a.status = 'active' AND a.handle = ANY($2::text[])
    ORDER BY a.handle ASC
    LIMIT 10`

/** The newest customers of the workspace: the pool a message's names are matched against. */
export const LIST_LEAD_REFS = sql`
    SELECT l.id, l.contact_name, l.company
    FROM public.leads l
    WHERE l.workspace_id = $1
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT $2`

/** The newest orders of the workspace: the pool a message's order numbers are matched against. */
export const LIST_ORDER_REFS = sql`
    SELECT o.id, o.order_no, o.lead_id
    FROM public.orders o
    WHERE o.workspace_id = $1
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT $2`

/** The candidate of one message. */
export const FIND_CANDIDATE_BY_MESSAGE = sql`
    SELECT c.id, c.message_id, c.module, c.command, c.payload, c.summary, c.shown, c.status, c.work_item_id,
           c.refusal_detail, to_json(c.created_at) #>> '{}' AS created_at
    FROM public.office_command_candidates c
    WHERE c.workspace_id = $1 AND c.message_id = $2
    LIMIT 1`

/** One candidate of the workspace. */
export const FIND_CANDIDATE = sql`
    SELECT c.id, c.message_id, c.module, c.command, c.payload, c.summary, c.shown, c.status, c.work_item_id,
           c.refusal_detail, to_json(c.created_at) #>> '{}' AS created_at
    FROM public.office_command_candidates c
    WHERE c.workspace_id = $1 AND c.id = $2
    LIMIT 1`

/** The latest candidates of the workspace, newest first. */
export const LIST_CANDIDATES = sql`
    SELECT c.id, c.message_id, c.module, c.command, c.payload, c.summary, c.shown, c.status, c.work_item_id,
           c.refusal_detail, to_json(c.created_at) #>> '{}' AS created_at
    FROM public.office_command_candidates c
    WHERE c.workspace_id = $1
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT $2`

/** Creates the candidate of a message; a second insert for the same message answers the first one. */
export const INSERT_CANDIDATE = sql`
    INSERT INTO public.office_command_candidates (workspace_id, message_id, module, command, payload, summary, shown, created_by)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8)
    ON CONFLICT (message_id) DO UPDATE SET message_id = EXCLUDED.message_id
    RETURNING id, message_id, module, command, payload, summary, shown, status, work_item_id, refusal_detail,
              to_json(created_at) #>> '{}' AS created_at`

/** Claims a pending candidate for sending in one statement, so a double click sends once. */
export const CLAIM_CANDIDATE = sql`
    WITH changed AS (
        UPDATE public.office_command_candidates
        SET status = 'sent', decided_at = now(), refusal_detail = NULL
        WHERE workspace_id = $1 AND id = $2 AND status = 'pending'
        RETURNING id, message_id, module, command, payload, summary, shown, status, work_item_id, refusal_detail, created_at
    )
    SELECT id, message_id, module, command, payload, summary, shown, status, work_item_id, refusal_detail,
           to_json(created_at) #>> '{}' AS created_at
    FROM changed`

/** Puts a claimed candidate back to pending with the reason the send failed. */
export const RELEASE_CANDIDATE = sql`
    UPDATE public.office_command_candidates
    SET status = 'pending', decided_at = NULL, refusal_detail = $3
    WHERE workspace_id = $1 AND id = $2`

/** Records the work item a sent candidate became. */
export const ATTACH_WORK_ITEM = sql`
    UPDATE public.office_command_candidates
    SET work_item_id = $3
    WHERE workspace_id = $1 AND id = $2`

/** Cancels a pending candidate; answers the row only when it was pending. */
export const CANCEL_CANDIDATE = sql`
    WITH changed AS (
        UPDATE public.office_command_candidates
        SET status = 'cancelled', decided_at = now()
        WHERE workspace_id = $1 AND id = $2 AND status = 'pending'
        RETURNING id
    )
    SELECT id FROM changed`
