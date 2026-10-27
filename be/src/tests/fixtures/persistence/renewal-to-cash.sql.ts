import { sql } from "@modules/platform/database"

/** The renewal invoice of one contract period ($1 workspace, $2 contract). */
export const RENEWAL_INVOICES = sql`
    SELECT id, invoice_no, amount_vnd::float8 AS amount_vnd, status, lead_id, contract_id,
           period_ends_on::text AS period_ends_on, paid_at
    FROM public.invoices WHERE workspace_id = $1 AND contract_id = $2
    ORDER BY created_at`

/** The work items of one action in a workspace, oldest first ($1 workspace, $2 action). */
export const WORK_ITEMS_OF_ACTION = sql`
    SELECT id, status, decided_path, reason, inbound_event_id, lead_id, proposal
    FROM public.work_items WHERE workspace_id = $1 AND action = $2
    ORDER BY created_at, id`

/** The runs of one pipeline, oldest first ($1 pipeline). */
export const PIPELINE_RUNS = sql`
    SELECT id, status, dedupe_key, steps, evidence, error
    FROM public.automation_runs WHERE pipeline_id = $1
    ORDER BY created_at, id`

/** The contract as it stands ($1 workspace, $2 contract). */
export const CONTRACT_STATE = sql`
    SELECT starts_on::text AS starts_on, ends_on::text AS ends_on, note, status
    FROM public.contracts WHERE workspace_id = $1 AND id = $2`

/** The bank credits of a workspace as inbound events, oldest first ($1 workspace). */
export const BANK_EVENTS = sql`
    SELECT id, status, amount_vnd::float8 AS amount_vnd, external_ref, event_id, lead_id, duplicate_count
    FROM public.inbound_events WHERE workspace_id = $1 AND channel = 'bank'
    ORDER BY created_at, id`

/** The bank transactions of a workspace ($1 workspace). */
export const BANK_TRANSACTIONS = sql`
    SELECT id, status, invoice_id, amount_vnd::float8 AS amount_vnd
    FROM public.transactions WHERE workspace_id = $1
    ORDER BY created_at, id`

/** The evidence lines of a workspace of one kind ($1 workspace, $2 kind). */
export const EVIDENCE_OF_KIND = sql`SELECT summary, evidence FROM public.events WHERE workspace_id = $1 AND kind = $2`

/** The queued bank-feed receipts of one connection, oldest first ($1 connection id). */
export const FEED_DELIVERIES = sql`
    SELECT id::text AS id, queue, name, payload FROM public.job_outbox
    WHERE queue = 'bank-feed-delivery' AND starts_with(payload->>'deliveryId', $1)
    ORDER BY created_at, id`

/** The queued reconcile-bank-credit jobs of a workspace, oldest first ($1 workspace). */
export const BANK_CREDIT_JOBS = sql`
    SELECT id::text AS id, queue, name, payload FROM public.job_outbox
    WHERE queue = 'bank_credit_received' AND payload->>'workspaceId' = $1
    ORDER BY created_at, id`

/** Removes the bank-feed receipts of one connection and their queue rows, which no workspace owns ($1 connection id). */
export const CLEAN_FEED_RECEIPTS = sql`
    WITH outbox AS (
        DELETE FROM public.job_outbox
        WHERE queue = 'bank-feed-delivery' AND starts_with(payload->>'deliveryId', $1)
    )
    DELETE FROM public.bank_feed_inbox WHERE starts_with(delivery_id, $1)`

/** Removes the claims the scenario's queue deliveries left, keyed by their outbox row ids ($1 job keys). */
export const CLEAN_JOB_KEYS = sql`DELETE FROM public.jobs WHERE job_key = ANY($1::text[])`
