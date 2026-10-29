import { sql } from "@modules/platform/database"

/** Makes a message look claimed once, with a one second visibility window. */
export const CLAIM_ENVELOPES = sql`
    UPDATE pgmq.q_content_tick SET read_ct = 1, vt = now() + interval '1 second' WHERE message->'payload'->>'proof' = ANY($1)
`
/** Reads the messages of the cutover queue that carry one of the proof tags. */
export const READ_ENVELOPES = sql`
    SELECT msg_id::text AS "msgId", message->'payload'->>'proof' AS proof
    FROM pgmq.q_content_tick WHERE message->'payload'->>'proof' = ANY($1) ORDER BY msg_id
`
/** The pgmq era renamed a finished message so no handler claims it. */
export const RENAME_DONE_ENVELOPE = sql`
    UPDATE pgmq.q_content_tick SET message = jsonb_set(message, '{name}', '"content_tick.special"')
    WHERE message->'payload'->>'proof' = 'raw-done'
`
