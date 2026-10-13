import { sql } from "@modules/platform/database"

/** The oldest open steps of the workspace, in the lead board's selection order. */
export const LIST_BOARD_RESPONSIBILITIES = sql`
    SELECT id, workspace_id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action,
           to_json(due_at) #>> '{}' AS due_at, status, to_json(created_at) #>> '{}' AS created_at
    FROM public.responsibilities
    WHERE workspace_id = $1 AND status <> 'done'
    ORDER BY created_at ASC, id ASC
    LIMIT 1000`

/** The customer's steps, oldest first, strictly within the workspace. */
export const LIST_LEAD_RESPONSIBILITIES = sql`
    SELECT id, workspace_id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action,
           to_json(due_at) #>> '{}' AS due_at, status, to_json(created_at) #>> '{}' AS created_at
    FROM public.responsibilities
    WHERE workspace_id = $1 AND lead_id = $2
    ORDER BY created_at ASC, id ASC
    LIMIT 200`

/** The open follow-ups of the workspace, earliest due first. */
export const LIST_OPEN_RESPONSIBILITIES = sql`
    SELECT id, workspace_id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action,
           to_json(due_at) #>> '{}' AS due_at, status, to_json(created_at) #>> '{}' AS created_at
    FROM public.responsibilities
    WHERE workspace_id = $1 AND status <> 'done'
    ORDER BY due_at ASC NULLS LAST, created_at ASC, id ASC
    LIMIT 500`

/** The open (not done) responsibility of a customer, newest first. */
export const FIND_OPEN_RESPONSIBILITY = sql`
    SELECT r.id, r.workspace_id, r.lead_id, r.title, r.owner_kind, r.owner_agent_id, r.owner_name, r.next_action,
           to_json(r.due_at) #>> '{}' AS due_at, r.status, to_json(r.created_at) #>> '{}' AS created_at
    FROM public.responsibilities r
    WHERE r.workspace_id = $1 AND r.lead_id = $2 AND r.status <> 'done'
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT 1`

/** The name of a customer of the workspace. */
export const FIND_LEAD_NAME = sql`
    SELECT l.contact_name
    FROM public.leads l
    WHERE l.workspace_id = $1 AND l.id = $2
    LIMIT 1`

/** The name of an agent of the workspace. */
export const FIND_AGENT_NAME = sql`
    SELECT a.id, a.name
    FROM public.agents a
    WHERE a.workspace_id = $1 AND a.id = $2
    LIMIT 1`

/** Creates a responsibility for a customer of the workspace; inserts nothing when the customer is not in it. */
export const INSERT_RESPONSIBILITY = sql`
    INSERT INTO public.responsibilities (workspace_id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action, due_at)
    SELECT l.workspace_id, l.id, $3, $4, $5::uuid, $6, $7, $8::timestamptz
    FROM public.leads l
    WHERE l.workspace_id = $1 AND l.id = $2
    RETURNING id, workspace_id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action,
              to_json(due_at) #>> '{}' AS due_at, status, to_json(created_at) #>> '{}' AS created_at`

/** The responsibilities of the workspace with the name of their customer, open ones first, newest first. */
export const LIST_RESPONSIBILITIES = sql`
    SELECT r.id, r.workspace_id, r.lead_id, r.title, r.owner_kind, r.owner_agent_id, r.owner_name, r.next_action,
           to_json(r.due_at) #>> '{}' AS due_at, r.status, to_json(r.created_at) #>> '{}' AS created_at,
           l.contact_name
    FROM public.responsibilities r
    JOIN public.leads l ON l.id = r.lead_id
    WHERE r.workspace_id = $1
    ORDER BY (r.status = 'done') ASC, r.created_at DESC, r.id DESC
    LIMIT 200`

/** Moves a responsibility of the workspace to a status and answers it. */
export const UPDATE_RESPONSIBILITY_STATUS = sql`
    WITH changed AS (
        UPDATE public.responsibilities r
        SET status = $3
        WHERE r.workspace_id = $1 AND r.id = $2
        RETURNING r.id, r.workspace_id, r.lead_id, r.title, r.owner_kind, r.owner_agent_id, r.owner_name, r.next_action,
                  r.due_at, r.status, r.created_at
    )
    SELECT c.id, c.workspace_id, c.lead_id, c.title, c.owner_kind, c.owner_agent_id, c.owner_name, c.next_action,
           to_json(c.due_at) #>> '{}' AS due_at, c.status, to_json(c.created_at) #>> '{}' AS created_at
    FROM changed c
    LIMIT 1`

/** One responsibility of the workspace ($1 workspace, $2 responsibility). */
export const FIND_RESPONSIBILITY = sql`
    SELECT r.id, r.workspace_id, r.lead_id, r.title, r.owner_kind, r.owner_agent_id, r.owner_name, r.next_action,
           to_json(r.due_at) #>> '{}' AS due_at, r.status, to_json(r.created_at) #>> '{}' AS created_at
    FROM public.responsibilities r
    WHERE r.workspace_id = $1 AND r.id = $2
    LIMIT 1`

/** Sets the next step of a responsibility of the workspace ($1 workspace, $2 responsibility, $3 text). */
export const UPDATE_RESPONSIBILITY_NEXT_ACTION = sql`
    UPDATE public.responsibilities SET next_action = $3 WHERE workspace_id = $1 AND id = $2`
