import { sql } from "@modules/platform/database"

/** The whole chat of an installation across its revisions, oldest first. */
export const LIST_INSTALLATION_MESSAGES = sql`
    SELECT m.id, m.setup_session_id AS "setupSessionId", m.role, m.author, m.body, to_json(m.created_at) #>> '{}' AS "createdAt"
    FROM public.module_setup_messages m
    JOIN public.module_setup_sessions s ON s.id = m.setup_session_id
    WHERE s.installation_id = $1
    ORDER BY m.created_at ASC, m.id ASC
    LIMIT 2000`

/** The chat of one session, oldest first. */
export const LIST_SESSION_MESSAGES = sql`
    SELECT id, setup_session_id AS "setupSessionId", role, author, body, to_json(created_at) #>> '{}' AS "createdAt"
    FROM public.module_setup_messages
    WHERE setup_session_id = $1
    ORDER BY created_at ASC, id ASC
    LIMIT 2000`

/** One message of the workspace by id. */
export const FIND_MESSAGE = sql`
    SELECT id, setup_session_id AS "setupSessionId", role, author, body, to_json(created_at) #>> '{}' AS "createdAt"
    FROM public.module_setup_messages
    WHERE id = $1 AND workspace_id = $2
    LIMIT 1`

/** Stores one line ($1 workspace, $2 session, $3 role, $4 author, $5 body). */
export const INSERT_SETUP_MESSAGE = sql`
    INSERT INTO public.module_setup_messages (workspace_id, setup_session_id, role, author, body)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, setup_session_id AS "setupSessionId", role, author, body, to_json(created_at) #>> '{}' AS "createdAt"`
