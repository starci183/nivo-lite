import { sql } from "@modules/platform/database"

/** One module's edited and rejected decisions since an instant, newest first, capped by the caller. */
export const LIST_RECENT_CORRECTIONS = sql`
    SELECT d.id, d.department, d.action, d.outcome, d.note,
           to_json(d.created_at) #>> '{}' AS created_at, d."before", d."after"
    FROM public.decisions d
    WHERE d.workspace_id = $1::uuid AND d.department = $2
      AND d.outcome IN ('edited', 'rejected') AND d.created_at >= $3::timestamptz
    ORDER BY d.created_at DESC LIMIT $4::int`
