import { sql } from "@modules/platform/database"

/** The private payloads authored by this proof, including their transport metadata ($1 topic). */
export const READ_TYPING_BROADCASTS = sql`
    SELECT payload, event, private, extension FROM realtime.messages
    WHERE topic = $1 ORDER BY inserted_at, id`

/** Removes only the current proof's workspace topics ($1 workspace). */
export const CLEAN_TYPING_BROADCASTS = sql`
    DELETE FROM realtime.messages WHERE split_part(topic, ':', 2) = $1::text`

/** Sets an authenticated receiver's JWT subject and private channel context ($1 subject, $2 topic). */
export const SET_TYPING_RECEIVER_CONTEXT = sql`
    SELECT set_config('request.jwt.claims', jsonb_build_object('sub', $1::text, 'role', 'authenticated')::text, true),
           set_config('realtime.topic', $2::text, true)`

/** Applies the real browser role inside a rolled-back proof. */
export const USE_TYPING_RECEIVER_ROLE = sql`SET LOCAL ROLE authenticated`

/** Restores the local proof connection after exercising the backend's write-only broadcast capability. */
export const RETURN_TYPING_PROOF_ROLE = sql`SET LOCAL ROLE NONE`

/** The authorization helper must safely reject malformed topics ($1 topic). */
export const TYPING_TOPIC_MEMBER = sql`SELECT be_access.chat_typing_topic_member($1::text, auth.uid()) AS allowed`

/** The helper must not let an authenticated caller select another account's membership ($1 topic, $2 claimed user). */
export const TYPING_TOPIC_MEMBER_AS = sql`SELECT be_access.chat_typing_topic_member($1::text, $2::uuid) AS allowed`

/** Only the backend can author a private broadcast ($1 topic, $2 JSON payload). */
export const PUBLISH_TYPING_BROADCAST = sql`
    SELECT be_access.broadcast_private($1::text, 'typing', $2::jsonb)`

/** A browser must not impersonate a typing sender through a raw realtime insert ($1 topic). */
export const INSERT_SPOOFED_TYPING_BROADCAST = sql`
    INSERT INTO realtime.messages (topic, event, payload, private, extension)
    VALUES ($1::text, 'typing', '{"id":"spoofed","typing":true}'::jsonb, true, 'broadcast')`

/** The backend's private wrapper never grants a browser or anonymous sender. */
export const TYPING_BROADCAST_PRIVILEGES = sql`
    SELECT has_function_privilege('app_be', 'be_access.broadcast_private(text,text,jsonb)', 'EXECUTE') AS backend,
           has_function_privilege('authenticated', 'be_access.broadcast_private(text,text,jsonb)', 'EXECUTE') AS browser,
           has_function_privilege('anon', 'be_access.broadcast_private(text,text,jsonb)', 'EXECUTE') AS anonymous`
