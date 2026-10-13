import { sql } from "@modules/platform/database"

/** The newest work items for the Sales workbench ($1 workspace, $2 limit). */
export const LIST_WORKBENCH_ITEMS = sql`SELECT * FROM public.work_items WHERE workspace_id = $1::uuid
ORDER BY created_at DESC, id DESC LIMIT $2::int`

/** The chronological steps in a customer's journey ($1 workspace, $2 customer). */
export const LIST_LEAD_ITEMS = sql`SELECT * FROM public.work_items WHERE workspace_id = $1::uuid AND lead_id = $2::uuid
ORDER BY created_at, id LIMIT 500`

/** Reopens a failed or rejected step without touching a concurrent transition ($1 workspace, $2 item, $3 allowed states). */
export const RETRY_WORK_ITEM = sql`WITH changed AS (
UPDATE public.work_items SET status = 'queued', error = NULL, reason = NULL, reasons = '{}', completed_at = NULL, updated_at = created_at
WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = ANY($3::text[]) RETURNING *
) SELECT * FROM changed`

/** Stops a failed item once ($1 workspace, $2 item, $3 instant). */
export const STOP_FAILED_WORK_ITEM = sql`WITH changed AS (
UPDATE public.work_items SET status = 'rejected', completed_at = $3::timestamptz, updated_at = $3::timestamptz
WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = 'failed' RETURNING *
) SELECT * FROM changed`

/** The newest accounting items' lineage ($1 workspace, $2 how many). */
export const LIST_ACCOUNTING_WORK_ITEMS = sql`
    SELECT id, action, status, subject_type, subject_id, to_json(created_at) #>> '{}' AS created_at
    FROM public.work_items
    WHERE workspace_id = $1::uuid AND department = 'accounting'
    ORDER BY created_at DESC, id DESC LIMIT $2::int`

/**
 * Inserts one queued work item and answers it; a second insert with the same dedupe key of the workspace answers nothing
 * ($1 workspace, $2 chain or null for a new chain, $3 depth, $4 department, $5 action, $6 subject type, $7 subject, $8 lead,
 * $9 inbound event, $10 parent, $11 dedupe key, $12 proposal json, $13 origin, $14 installation or null for the database to
 * resolve). The id comes from the database; a root item is the root of its own chain.
 */
export const INSERT_WORK_ITEM = sql`
    WITH fresh AS (SELECT gen_random_uuid() AS id)
    INSERT INTO public.work_items (
        id, workspace_id, chain_id, depth, department, action, subject_type, subject_id, lead_id,
        inbound_event_id, parent_id, dedupe_key, status, proposal, origin, installation_id
    )
    SELECT
        fresh.id, $1::uuid, COALESCE($2::uuid, fresh.id), $3::int, $4, $5, $6, $7::uuid, $8::uuid,
        $9::uuid, $10::uuid, $11, 'queued', $12::jsonb, $13, $14::uuid
    FROM fresh
    ON CONFLICT (workspace_id, dedupe_key) DO NOTHING
    RETURNING *`

/** The item a dedupe key already stands for ($1 workspace, $2 dedupe key). */
export const FIND_WORK_ITEM_BY_DEDUPE = sql`
    SELECT * FROM public.work_items
    WHERE workspace_id = $1::uuid AND dedupe_key = $2
    LIMIT 1`

/**
 * Takes a queued item for processing: the lease. An item is free when nobody touched it since it was written or when its
 * last touch is older than the lease, so two workers never perform it twice and a crashed worker's item is taken over
 * ($1 id, $2 workspace, $3 now, $4 lease seconds).
 */
export const CLAIM_WORK_ITEM = sql`
    WITH changed AS (
        UPDATE public.work_items
        SET updated_at = $3::timestamptz
        WHERE id = $1::uuid AND workspace_id = $2::uuid AND status = 'queued'
            AND (updated_at = created_at OR updated_at < $3::timestamptz - make_interval(secs => $4::int))
        RETURNING *
    )
    SELECT * FROM changed`

/** The oldest queued chain step of the workspace that is free to take ($1 workspace, $2 now, $3 lease seconds). */
export const NEXT_QUEUED_WORK_ITEM = sql`
    SELECT * FROM public.work_items
    WHERE workspace_id = $1::uuid AND status = 'queued' AND reason IS NULL
        AND (updated_at = created_at OR updated_at < $2::timestamptz - make_interval(secs => $3::int))
    ORDER BY created_at ASC, id ASC
    LIMIT 1`

/** Saves what the performer prepared and the address it corrected ($1 id, $2 proposal json, $3 type, $4 subject, $5 lead, $6 now). */
export const SAVE_PREPARED_WORK_ITEM = sql`
    WITH changed AS (
        UPDATE public.work_items
        SET proposal = $2::jsonb,
            subject_type = COALESCE($3, subject_type),
            subject_id = COALESCE($4::uuid, subject_id),
            lead_id = COALESCE($5::uuid, lead_id),
            updated_at = $6::timestamptz
        WHERE id = $1::uuid
        RETURNING *
    )
    SELECT * FROM changed`

/** Marks an item failed ($1 id, $2 error, $3 now). */
export const MARK_WORK_ITEM_FAILED = sql`
    WITH changed AS (
        UPDATE public.work_items
        SET status = 'failed', error = $2, updated_at = $3::timestamptz
        WHERE id = $1::uuid
        RETURNING *
    )
    SELECT * FROM changed`

/**
 * Puts an item in front of a person ($1 id, $2 reason, $3 reasons, $4 missing fields, $5 proposal json, $6 approval
 * execution or null, $7 now).
 */
export const MARK_WORK_ITEM_WAITING = sql`
    WITH changed AS (
        UPDATE public.work_items
        SET status = 'waiting_decision', reason = $2, reasons = $3::text[], missing_fields = $4::text[],
            proposal = $5::jsonb, execution_id = $6::uuid, decided_path = NULL, error = NULL, updated_at = $7::timestamptz
        WHERE id = $1::uuid
        RETURNING *
    )
    SELECT * FROM changed`

/**
 * Closes an item as done ($1 id, $2 path auto or human, $3 proposal json, $4 result json, $5 evidence state, $6 now, $7 lead the
 * performer found or null). An automatic path also records the routine reason.
 */
export const MARK_WORK_ITEM_DONE = sql`
    WITH changed AS (
        UPDATE public.work_items
        SET status = 'done', decided_path = $2::text, proposal = $3::jsonb, result = $4::jsonb, evidence_state = $5,
            completed_at = $6::timestamptz, updated_at = $6::timestamptz, error = NULL, lead_id = COALESCE($7::uuid, lead_id),
            reason = CASE WHEN $2::text = 'auto' THEN 'routine' ELSE reason END,
            reasons = CASE WHEN $2::text = 'auto' THEN ARRAY['routine'] ELSE reasons END,
            missing_fields = '{}'
        WHERE id = $1::uuid
        RETURNING *
    )
    SELECT * FROM changed`

/** Closes an item as rejected by a person ($1 id, $2 proposal json, $3 now, $4 result json). */
export const MARK_WORK_ITEM_REJECTED = sql`
    WITH changed AS (
        UPDATE public.work_items
        SET status = 'rejected', decided_path = 'human', proposal = $2::jsonb, completed_at = $3::timestamptz,
            updated_at = $3::timestamptz, result = $4::jsonb
        WHERE id = $1::uuid
        RETURNING *
    )
    SELECT * FROM changed`

/** Puts an item back in front of the person who approved it because data is still missing ($1 id, $2 proposal json, $3 missing, $4 reason, $5 reasons, $6 now). */
export const MARK_WORK_ITEM_STILL_WAITING = sql`
    WITH changed AS (
        UPDATE public.work_items
        SET status = 'waiting_decision', proposal = $2::jsonb, missing_fields = $3::text[], reason = $4, reasons = $5::text[],
            updated_at = $6::timestamptz
        WHERE id = $1::uuid
        RETURNING *
    )
    SELECT * FROM changed`

/** Guarded transition of a decision: only an item that waits becomes queued again, so a double click decides once ($1 id, $2 workspace, $3 now). */
export const REOPEN_WAITING_WORK_ITEM = sql`
    WITH changed AS (
        UPDATE public.work_items
        SET status = 'queued', updated_at = $3::timestamptz
        WHERE id = $1::uuid AND workspace_id = $2::uuid AND status = 'waiting_decision'
        RETURNING *
    )
    SELECT * FROM changed`

/** Links an approval card to the item that opened it ($1 workspace, $2 item, $3 card). */
export const ATTACH_WORK_ITEM_EXECUTION = sql`
    UPDATE public.work_items SET execution_id = $3::uuid
    WHERE workspace_id = $1::uuid AND id = $2::uuid`

/**
 * Closes the customer's "I paid" checks that still wait for an invoice that has just been paid: nobody approved them, they are settled
 * ($1 workspace, $2 the item that settled the invoice, $3 dedupe key prefix, $4 result json, $5 now). Answers the closed items.
 */
export const SETTLE_WAITING_CLAIMS = sql`
    WITH changed AS (
        UPDATE public.work_items
        SET status = 'done', decided_path = 'auto', reason = 'routine', completed_at = $5::timestamptz, updated_at = $5::timestamptz,
            evidence_state = 'verified', result = $4::jsonb
        WHERE workspace_id = $1::uuid AND action = 'reconcile_payment' AND status = 'waiting_decision'
          AND id <> $2::uuid AND dedupe_key LIKE $3 || '%'
        RETURNING id, inbound_event_id
    )
    SELECT id, inbound_event_id FROM changed`

/** The oldest available queued step belonging to this inbound input only ($1 workspace, $2 event, $3 now, $4 lease seconds). */
export const NEXT_INBOUND_QUEUED_WORK_ITEM = sql`SELECT * FROM public.work_items
WHERE workspace_id = $1::uuid AND inbound_event_id = $2::uuid AND status = 'queued' AND reason IS NULL
    AND (updated_at = created_at OR updated_at < $3::timestamptz - make_interval(secs => $4::int))
ORDER BY created_at ASC, id ASC LIMIT 1`

/** Sets who an item is assigned to; null takes it back ($1 workspace, $2 item, $3 staff or null, $4 now). */
export const ASSIGN_WORK_ITEM = sql`
    WITH changed AS (
        UPDATE public.work_items
        SET assigned_staff_id = $3::uuid, updated_at = $4::timestamptz
        WHERE workspace_id = $1::uuid AND id = $2::uuid
        RETURNING *
    )
    SELECT * FROM changed`

/**
 * Keeps a waiting item waiting and stores the owner's note on its proposal
 * ($1 workspace, $2 item, $3 note, $4 actor, $5 now). A row that is no longer waiting answers nothing.
 */
export const HOLD_WORK_ITEM = sql`
    WITH changed AS (
        UPDATE public.work_items
        SET proposal = jsonb_set(
                COALESCE(proposal, '{}'::jsonb),
                '{fields}',
                COALESCE(proposal -> 'fields', '{}'::jsonb) || jsonb_build_object('hold_note', $3::text, 'hold_by', $4::text, 'hold_at', $5::text),
                true
            ),
            updated_at = $5::timestamptz
        WHERE workspace_id = $1::uuid AND id = $2::uuid AND status = 'waiting_decision'
        RETURNING *
    )
    SELECT * FROM changed`

/** Every pending, failed and decision-waiting step of the inbound input, including lease-held work ($1 workspace, $2 event). */
export const READ_INBOUND_WORK_STATE = sql`SELECT
    (COUNT(*) FILTER (WHERE status = 'queued'))::int AS queued,
    (COUNT(*) FILTER (WHERE status = 'failed'))::int AS failed,
    (COUNT(*) FILTER (WHERE status = 'waiting_decision'))::int AS waiting
FROM public.work_items WHERE workspace_id = $1::uuid AND inbound_event_id = $2::uuid`
