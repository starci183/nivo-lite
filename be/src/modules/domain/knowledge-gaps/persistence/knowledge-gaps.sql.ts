import { sql } from "@modules/platform/database"

/** The gaps of a workspace with these statuses, most asked first ($1 workspace, $2 statuses, $3 limit). */
export const SELECT_GAPS = sql`SELECT id, module, question, question_key, keywords, topic, attribute_guess, count, first_seen_at, last_seen_at,
    example_conversation_id, status, reopened_count
FROM public.knowledge_gaps WHERE workspace_id = $1 AND status = ANY($2::text[])
ORDER BY count DESC, last_seen_at DESC LIMIT $3`

/** The latest gaps of one agent, to find a similar question ($1 workspace, $2 module, $3 limit). */
export const SELECT_GAP_CANDIDATES = sql`SELECT id, module, question, question_key, keywords, topic, attribute_guess, count, first_seen_at,
    last_seen_at, example_conversation_id, status, reopened_count
FROM public.knowledge_gaps WHERE workspace_id = $1 AND module = $2 ORDER BY last_seen_at DESC LIMIT $3`

/** Counts a question once more; an answered gap opens again ($1 workspace, $2 id, $3 topic, $4 attribute, $5 conversation). */
export const BUMP_GAP = sql`WITH changed AS (
    UPDATE public.knowledge_gaps SET
        count = count + 1, last_seen_at = now(), updated_at = now(),
        topic = coalesce(topic, $3), attribute_guess = coalesce(attribute_guess, $4),
        example_conversation_id = coalesce(example_conversation_id, $5::uuid),
        status = CASE WHEN status = 'answered' THEN 'open' ELSE status END,
        answered_at = CASE WHEN status = 'answered' THEN NULL ELSE answered_at END,
        answered_by = CASE WHEN status = 'answered' THEN NULL ELSE answered_by END,
        reopened_count = CASE WHEN status = 'answered' THEN reopened_count + 1 ELSE reopened_count END
    WHERE workspace_id = $1 AND id = $2
    RETURNING id, module, question, question_key, keywords, topic, attribute_guess, count, first_seen_at, last_seen_at,
        example_conversation_id, status, reopened_count
)
SELECT * FROM changed`

/** Starts a gap; no row when the same question was just recorded ($1 workspace, $2 module, $3 question, $4 key, $5 keywords, $6 topic, $7 attribute, $8 conversation, $9 source). */
export const INSERT_GAP = sql`WITH changed AS (
    INSERT INTO public.knowledge_gaps (workspace_id, module, question, question_key, keywords, topic, attribute_guess, example_conversation_id, source)
    VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8::uuid, $9)
    ON CONFLICT (workspace_id, module, question_key) DO NOTHING
    RETURNING id, module, question, question_key, keywords, topic, attribute_guess, count, first_seen_at, last_seen_at,
        example_conversation_id, status, reopened_count
)
SELECT * FROM changed`

/** The owner does not need this answered ($1 workspace, $2 id, $3 by). */
export const DISMISS_GAP = sql`WITH changed AS (
    UPDATE public.knowledge_gaps SET status = 'dismissed', dismissed_at = now(), dismissed_by = $3, updated_at = now()
    WHERE workspace_id = $1 AND id = $2 AND status <> 'answered' RETURNING id
)
SELECT id FROM changed`

/** The gap is answered ($1 workspace, $2 id, $3 by). */
export const ANSWER_GAP = sql`WITH changed AS (
    UPDATE public.knowledge_gaps SET status = 'answered', answered_at = now(), answered_by = $3, updated_at = now()
    WHERE workspace_id = $1 AND id = $2 AND status = 'open' RETURNING id
)
SELECT id FROM changed`

/** The open gaps of a workspace ($1 workspace, $2 limit). */
export const SELECT_OPEN_GAPS = sql`SELECT id, module, keywords, question FROM public.knowledge_gaps WHERE workspace_id = $1 AND status = 'open' LIMIT $2`

/** How many gaps wait for an answer ($1 workspace). */
export const COUNT_OPEN_GAPS = sql`SELECT count(*)::int AS total FROM public.knowledge_gaps WHERE workspace_id = $1 AND status = 'open'`
