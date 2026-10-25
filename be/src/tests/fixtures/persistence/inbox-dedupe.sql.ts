import { sql } from "@modules/platform/database"

/** The hold's evidence lines, including duplicates ($1 workspace, $2 work item). */
export const HOLD_EVENTS = sql`SELECT evidence FROM public.events
WHERE workspace_id = $1 AND work_item_id = $2 AND kind = 'work.held'`

/** The operation's card lines ($1 workspace, $2 title). */
export const NOTE_CARDS = sql`SELECT id FROM public.messages WHERE workspace_id = $1 AND card->>'title' = $2`

/** The durable claim for one operation ($1 source, $2 delivery id). */
export const INBOX_CLAIM = sql`SELECT delivery_id FROM public.inbox WHERE source = $1 AND delivery_id = $2`

/** Removes exactly the scenario's claim ($1 source, $2 delivery id). */
export const CLEAN_INBOX_CLAIM = sql`DELETE FROM public.inbox WHERE source = $1 AND delivery_id = $2`

/** Removes the suite's gateway receipts' inbox claims before the workspace is removed ($1 workspace). */
export const CLEAN_GATEWAY_CLAIMS = sql`DELETE FROM public.inbox
WHERE source = 'mcp.gateway' AND starts_with(delivery_id, $1 || ':')`

/** Makes the evidence insert fail inside the real transaction, after the claim and hold write. */
export const FAIL_TRANSACTION = sql`SELECT 1 / 0`

/** Grants the proof agent the local connector's write tool ($1 workspace, $2 agent). */
export const GRANT_HAKUEN = sql`INSERT INTO public.mcp_tool_grants (workspace_id, agent_id, tool, mode)
VALUES ($1, $2, 'hakuen.*', 'auto')`

/** Inserts a card through the database boundary without the application parser ($1 workspace, $2 JSON card or SQL null). */
export const INSERT_PROOF_CARD = sql`INSERT INTO public.messages (workspace_id, author_kind, author_name, body, card)
VALUES ($1, 'system', 'Card validation proof', 'Card validation proof', $2::jsonb)
RETURNING card`
