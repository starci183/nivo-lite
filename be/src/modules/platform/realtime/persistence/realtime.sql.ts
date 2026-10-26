import { sql } from "@modules/platform/database"

/**
 * Takes the transaction-scoped lock of a topic ($1 the lock class of the realtime capability, $2 topic), so the frames of one topic commit in the order their sequence numbers are
 * assigned: a reader that saw sequence N never misses a frame below N of the same topic.
 */
export const LOCK_TOPIC = sql`SELECT pg_advisory_xact_lock($1::int, hashtext($2::text)) LIMIT 1`

/**
 * Writes one frame and notifies every replica in the same statement; the notification is delivered when the transaction commits
 * ($1 topic, $2 frame id or null, $3 frame as JSON, $4 channel).
 */
export const PUBLISH_EVENT = sql`WITH written AS (
    INSERT INTO public.realtime_events (topic, event_id, payload) VALUES ($1, $2, $3::jsonb) RETURNING seq
)
SELECT pg_notify($4, json_build_object('topic', $1::text, 'seq', written.seq)::text) FROM written`

/** Reads the row a notification names ($1 seq); a row the sweep already deleted answers nothing. */
export const SELECT_EVENT = sql`SELECT seq, topic, payload FROM public.realtime_events WHERE seq = $1 LIMIT 1`

/**
 * The frames of a topic published after the frame with id $2, oldest first, at most $3. An id the table no longer holds
 * replays the newest $3 frames of the topic ($1 topic, $2 frame id, $3 limit).
 */
export const SELECT_EVENTS_AFTER = sql`SELECT seq, topic, payload FROM (
    SELECT seq, topic, payload FROM public.realtime_events
    WHERE topic = $1 AND seq > COALESCE((SELECT max(seq) FROM public.realtime_events WHERE topic = $1 AND event_id = $2), 0)
    ORDER BY seq DESC LIMIT $3
) AS newest ORDER BY seq LIMIT $3`

/**
 * The highest sequence number a topic has committed so far ($1 topic): where a subscription to the topic starts to follow. Because the
 * frames of one topic are written under the topic lock, this is the newest frame of that topic every later frame follows in commit order.
 */
export const SELECT_TOPIC_HIGHEST_SEQ = sql`SELECT COALESCE(max(seq), 0) AS seq FROM public.realtime_events WHERE topic = $1 LIMIT 1`

/**
 * The frames of the given topics published after each topic's own cursor, oldest first, at most $3 ($1 topics, $2 the cursor of each
 * topic in the same order, $3 limit).
 */
export const SELECT_MISSED_EVENTS = sql`SELECT e.seq, e.topic, e.payload FROM public.realtime_events e
    JOIN unnest($1::text[], $2::bigint[]) AS cursors(topic, after) ON e.topic = cursors.topic AND e.seq > cursors.after
    ORDER BY e.seq LIMIT $3`

/** Deletes one bounded batch of frames older than $1 milliseconds on the database clock (the clock that stamped them) and answers how many it deleted ($1 replay window in ms, $2 batch size). */
export const DELETE_EXPIRED_EVENTS = sql`WITH expired AS (
    DELETE FROM public.realtime_events
    WHERE seq IN (SELECT seq FROM public.realtime_events WHERE created_at < now() - make_interval(secs => $1::double precision / 1000) ORDER BY seq LIMIT $2)
    RETURNING seq
)
SELECT count(*) AS deleted FROM expired`

/** Sends a notification from this session to the hub channel ($1 channel, $2 payload): the cross-session probe of a new LISTEN connection. */
export const NOTIFY_PROBE = sql`SELECT pg_notify($1, $2) LIMIT 1`
