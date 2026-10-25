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

/**
 * Records one accepted request in the ledger, once per dedupe key; a repeat only counts. The dedupe key is the prefix and the
 * suffix, or the prefix and a fresh id when the suffix is empty. Answers the request, the customer a processed hand-over created
 * and whether this call wrote the row ($1 workspace, $2 key, $3 kind, $4 dedupe prefix, $5 dedupe suffix or empty, $6 body json).
 */
export const INSERT_REQUEST = sql`INSERT INTO public.public_api (workspace_id, key_id, kind, dedupe_key, payload, need_supplied)
VALUES ($1, $2, $3, $4::text || COALESCE(NULLIF($5::text, ''), gen_random_uuid()::text), $6::jsonb,
    ($6::jsonb ->> 'needSupplied')::boolean)
ON CONFLICT (workspace_id, dedupe_key) DO UPDATE SET duplicates = public.public_api.duplicates + 1
RETURNING id, lead_id, (xmax = 0) AS inserted`

/** A customer conversation of a workspace by id ($1 workspace, $2 conversation). */
export const SELECT_CONVERSATION = sql`SELECT id, lead_id FROM public.agent_conversations
WHERE workspace_id = $1 AND kind = 'customer' AND id = $2
LIMIT 1`

/** The latest customer conversation of a customer ($1 workspace, $2 customer). */
export const SELECT_CONVERSATION_OF_LEAD = sql`SELECT id, lead_id FROM public.agent_conversations
WHERE workspace_id = $1 AND kind = 'customer' AND lead_id = $2
ORDER BY created_at DESC
LIMIT 1`

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
