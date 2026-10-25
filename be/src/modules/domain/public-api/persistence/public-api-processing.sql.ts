import { sql } from "@modules/platform/database"

/** Locks only the request belonging to this workspace ($1 workspace, $2 request). */
export const LOCK_PUBLIC_API_REQUEST = sql`SELECT id, kind, payload, need_supplied, lead_id, processed_at
FROM public.public_api WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1 FOR UPDATE`

/** Completes an admission only with its committed domain handoff ($1 workspace, $2 request, $3 resolved lead). */
export const COMPLETE_PUBLIC_API_REQUEST = sql`UPDATE public.public_api
SET processed_at = now(), lead_id = COALESCE($3::uuid, lead_id)
WHERE workspace_id = $1::uuid AND id = $2::uuid AND processed_at IS NULL`
