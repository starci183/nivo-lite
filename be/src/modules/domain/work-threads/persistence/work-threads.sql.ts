import { sql } from "@modules/platform/database"

/** The workspace's thread ($1 workspace, $2 thread). */
export const FIND_THREAD = sql`SELECT id, workspace_id, title, lead_id, order_id, status, created_by,
       to_json(created_at) #>> '{}' AS created_at, to_json(updated_at) #>> '{}' AS updated_at
FROM public.work_threads
WHERE workspace_id = $1::uuid AND id = $2::uuid
LIMIT 1`

/** The workspace's thread, locked while a message or a status change is written ($1 workspace, $2 thread). */
export const LOCK_THREAD = sql`SELECT id, workspace_id, title, lead_id, order_id, status, created_by,
       to_json(created_at) #>> '{}' AS created_at, to_json(updated_at) #>> '{}' AS updated_at
FROM public.work_threads
WHERE workspace_id = $1::uuid AND id = $2::uuid
LIMIT 1
FOR UPDATE`

/** Threads by immutable creation order ($1 workspace, $2 lead or null, $3 cursor instant, $4 cursor id, $5 limit). */
export const LIST_THREADS = sql`SELECT id, workspace_id, title, lead_id, order_id, status, created_by,
       to_json(created_at) #>> '{}' AS created_at, to_json(updated_at) #>> '{}' AS updated_at
FROM public.work_threads
WHERE workspace_id = $1::uuid AND ($2::uuid IS NULL OR lead_id = $2::uuid)
  AND ($3::timestamptz IS NULL OR (created_at, id) < ($3::timestamptz, $4::uuid))
ORDER BY work_threads.created_at DESC, id DESC
LIMIT $5`

/** Opens a thread ($1 workspace, $2 title, $3 lead or null, $4 order or null, $5 member). */
export const INSERT_THREAD = sql`INSERT INTO public.work_threads (workspace_id, title, lead_id, order_id, created_by)
VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5::uuid)
RETURNING id, workspace_id, title, lead_id, order_id, status, created_by,
          to_json(created_at) #>> '{}' AS created_at, to_json(updated_at) #>> '{}' AS updated_at`

/** The lead of the workspace, when it is one ($1 workspace, $2 lead). */
export const FIND_LEAD = sql`SELECT id FROM public.leads WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`

/** The order of the workspace, when it is one ($1 workspace, $2 order). */
export const FIND_ORDER = sql`SELECT id FROM public.orders WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`

/** Sets the status of a thread and marks it changed ($1 workspace, $2 thread, $3 status). */
export const SET_THREAD_STATUS = sql`UPDATE public.work_threads SET status = $3, updated_at = now()
WHERE workspace_id = $1::uuid AND id = $2::uuid`
