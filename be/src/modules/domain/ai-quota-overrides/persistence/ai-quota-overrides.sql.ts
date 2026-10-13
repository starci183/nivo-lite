import { sql } from "@modules/platform/database"

/** Sets the own monthly credit allowance of a workspace; null clears it ($1 workspace, $2 credits, $3 instant). */
export const UPSERT_CREDITS_LIMIT = sql`INSERT INTO public.ai_quota_overrides (workspace_id, credits_limit, updated_at)
VALUES ($1, $2, $3)
ON CONFLICT (workspace_id) DO UPDATE SET credits_limit = EXCLUDED.credits_limit, updated_at = EXCLUDED.updated_at`
