import { sql } from "@modules/platform/database"

/** The oldest customer of a workspace with a phone ($1 workspace, $2 normalised phone). */
export const MATCH_LEAD_BY_PHONE = sql`SELECT id FROM public.leads
WHERE workspace_id = $1 AND phone = $2
ORDER BY created_at
LIMIT 1`

/** The oldest customer of a workspace with an email ($1 workspace, $2 normalised email). */
export const MATCH_LEAD_BY_EMAIL = sql`SELECT id FROM public.leads
WHERE workspace_id = $1 AND email = $2
ORDER BY created_at
LIMIT 1`

/** The oldest customer of a workspace with a name on a channel; used only when the request carries no contact ($1 workspace, $2 name, $3 channel). */
export const MATCH_LEAD_BY_NAME = sql`SELECT id FROM public.leads
WHERE workspace_id = $1 AND contact_name = $2 AND channel = $3
ORDER BY created_at
LIMIT 1`

/** Records one customer handed over by a key, once per dedupe key; a repeat answers no row ($1 workspace, $2 name, $3 contact, $4 text, $5 source, $6 event id, $7 dedupe key). */
export const INSERT_INBOUND_LEAD = sql`INSERT INTO public.inbound_events
    (workspace_id, channel, kind, origin, sender_name, sender_contact, body, amount_vnd, external_ref, event_id, dedupe_key)
VALUES ($1, 'manual', 'lead', 'live', $2, $3, $4, NULL, $5, $6, $7)
ON CONFLICT (workspace_id, dedupe_key) DO NOTHING
RETURNING id`

/** Counts a repeated delivery of the same customer and answers the customer it belongs to ($1 workspace, $2 dedupe key). */
export const BUMP_INBOUND_DUPLICATE = sql`UPDATE public.inbound_events
SET duplicate_count = duplicate_count + 1, last_duplicate_at = now()
WHERE workspace_id = $1 AND dedupe_key = $2
RETURNING lead_id`

/** Appends one evidence line ($1 workspace, $2 customer or null, $3 kind, $4 actor, $5 summary, $6 evidence). */
export const INSERT_EVIDENCE = sql`INSERT INTO public.events (workspace_id, lead_id, kind, actor, summary, evidence)
VALUES ($1, $2, $3, $4, $5, $6)`

/** A customer conversation of a workspace by id ($1 workspace, $2 conversation). */
export const SELECT_CONVERSATION = sql`SELECT id, lead_id FROM public.agent_conversations
WHERE workspace_id = $1 AND kind = 'customer' AND id = $2`

/** The latest customer conversation of a customer ($1 workspace, $2 customer). */
export const SELECT_CONVERSATION_OF_LEAD = sql`SELECT id, lead_id FROM public.agent_conversations
WHERE workspace_id = $1 AND kind = 'customer' AND lead_id = $2
ORDER BY created_at DESC
LIMIT 1`

/** Writes a text knowledge source with status queued, to be indexed by its job ($1 workspace, $2 topic, $3 tags, $4 visibility, $5 title, $6 content, $7 source). */
export const INSERT_KNOWLEDGE_SOURCE = sql`INSERT INTO public.knowledge_sources
    (workspace_id, kind, topic, tags, visibility, title, content, status, progress, origin)
VALUES ($1, 'text', $2, $3, $4, $5, $6, 'queued', 0, $7)
RETURNING id`

/** The customers of a workspace, newest first, optionally of one stage ($1 workspace, $2 stage or null, $3 limit). */
export const LIST_LEADS = sql`SELECT id, contact_name, company, channel, need, stage, phone, email,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
FROM public.leads
WHERE workspace_id = $1 AND ($2::text IS NULL OR stage = $2)
ORDER BY leads.created_at DESC
LIMIT $3`

/** The evidence lines of a workspace after a time, oldest first ($1 workspace, $2 since, $3 limit). */
export const LIST_EVENTS = sql`SELECT id, kind, actor, summary, left(evidence, 500) AS evidence, lead_id,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
FROM public.events
WHERE workspace_id = $1 AND created_at > $2
ORDER BY events.created_at ASC
LIMIT $3`
