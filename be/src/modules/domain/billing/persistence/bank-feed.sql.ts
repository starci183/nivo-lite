import { sql } from "@modules/platform/database"

/** A connection with its encrypted credential and webhook secret ($1 connection id). */
export const SELECT_CONNECTION_SECRET = sql`SELECT c.workspace_id, c.status, c.provider, s.ciphertext, s.webhook_secret
FROM public.connections c
JOIN public.connection_secrets s ON s.connection_id = c.id
WHERE c.id = $1
LIMIT 1`

/** The facts of a connection the feed needs before it records a credit ($1 connection id). */
export const SELECT_CONNECTION_STATE = sql`SELECT name, environment, status
FROM public.connections
WHERE id = $1
LIMIT 1`

/** The oldest active accounting agent bound to the connection for its bank feed ($1 connection id). */
export const SELECT_BOUND_ACCOUNTING_AGENT = sql`SELECT a.id
FROM public.agent_connections ac
JOIN public.agents a ON a.id = ac.agent_id
WHERE ac.connection_id = $1 AND ac.purpose = 'bank_feed' AND a.status = 'active' AND a.module = 'accounting'
ORDER BY a.created_at
LIMIT 1`

/**
 * Remembers that the connection works: last event time, no error, pending or errored becomes connected, and the first credit it
 * ever accepted is kept. The connection table belongs to the connections capability, so billing asks the database function
 * (invoker rights, under the same row policies) instead of writing the table ($1 connection id, $2 instant, $3 first event JSON).
 */
export const MARK_CONNECTION_FED = sql`SELECT public.connection_mark_fed($1, $2, $3::jsonb)`

/** Resolves the connection's workspace without retaining any provider credential in the receipt. */
export const SELECT_FEED_CONNECTION = sql`SELECT workspace_id FROM public.connections WHERE id = $1 LIMIT 1`
