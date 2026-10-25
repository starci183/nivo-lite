import { sql } from "@modules/platform/database"

/** The admitted request and its consumer completion, observed outside the fenced transaction. */
export const API_REQUEST = sql`SELECT id, kind, payload, need_supplied, lead_id, processed_at
FROM public.public_api WHERE workspace_id = $1::uuid AND id = $2::uuid`

/** The request the lead producer admitted under its caller's external identity. */
export const API_LEAD_REQUEST = sql`SELECT id, kind, payload, need_supplied, lead_id, processed_at
FROM public.public_api WHERE workspace_id = $1::uuid AND payload->>'externalId' = $2 LIMIT 1`

/** The latest message admission for one isolated customer conversation. */
export const API_MESSAGE_REQUEST = sql`SELECT id, kind, payload, need_supplied, lead_id, processed_at
FROM public.public_api WHERE workspace_id = $1::uuid AND payload->>'conversationId' = $2
ORDER BY created_at DESC, id DESC LIMIT 1`

/** The retained facts of an existing customer. */
export const API_LEAD = sql`SELECT id, need, company, channel, stage FROM public.leads
WHERE workspace_id = $1::uuid AND id = $2::uuid`

/** Every durable handoff of this isolated workspace. */
export const API_WORK = sql`SELECT id, action, status, subject_type, subject_id, lead_id, inbound_event_id, dedupe_key, proposal, reason
FROM public.work_items WHERE workspace_id = $1::uuid ORDER BY created_at, id`

/** The original inbound record reused by new and historical API jobs. */
export const API_INBOUND = sql`SELECT id, event_id, body, lead_id FROM public.inbound_events
WHERE workspace_id = $1::uuid ORDER BY created_at, id`

/** The promised stable source identity and its normalized metadata. */
export const API_SOURCE = sql`SELECT id, title, content, topic, tags, visibility, origin FROM public.knowledge_sources
WHERE workspace_id = $1::uuid AND id = $2::uuid`

/** Queue handoffs are successful fulfillment; external indexing and delivery remain separate work. */
export const API_OUTBOX = sql`SELECT id, queue, name, dedupe_key, payload FROM public.job_outbox
WHERE payload->>'workspaceId' = $1 ORDER BY created_at, id`

/** Inbox receipts of public API and manual inbound inputs in this workspace. */
export const API_INBOX = sql`SELECT source, delivery_id FROM public.inbox
WHERE starts_with(delivery_id, $1 || ':')
   OR delivery_id IN (SELECT event_id FROM public.inbound_events WHERE workspace_id = $1::uuid)
ORDER BY source, delivery_id`

/** Evidence remains exactly once across queue delivery identities. */
export const API_EVENTS = sql`SELECT kind, actor, summary, evidence, lead_id FROM public.events
WHERE workspace_id = $1::uuid ORDER BY created_at, id`

/** Removes only the messages and publications created by one isolated workspace. */
export const CLEAN_API_PUBLICATIONS = sql`WITH api AS (
    DELETE FROM pgmq.q_public_api WHERE message->'payload'->>'workspaceId' = $1
), knowledge AS (
    DELETE FROM pgmq.q_knowledge WHERE message->'payload'->>'workspaceId' = $1
), automation AS (
    DELETE FROM pgmq.q_automation WHERE message->'payload'->>'workspaceId' = $1
)
DELETE FROM public.job_outbox WHERE payload->>'workspaceId' = $1`

/** Removes only receipts owned by this workspace's API or manual inputs before their domain rows disappear. */
export const CLEAN_API_INBOX = sql`DELETE FROM public.inbox
WHERE starts_with(delivery_id, $1 || ':')
   OR delivery_id IN (SELECT event_id FROM public.inbound_events WHERE workspace_id = $1::uuid)`

/** Removes only the terminal receipt of this proof's original delivery identity. */
export const CLEAN_API_FAILED_RECEIPT = sql`DELETE FROM public.inbox
WHERE source = 'public_api.failed' AND delivery_id = $1`
