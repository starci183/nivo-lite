import { sql } from "@modules/platform/database"

/** Mails of the workspace's IMAP sync that carry an XML attachment with its text, newest first. */
export const LIST_INVOICE_MAILS = sql`
    SELECT r.id, r.data -> 'attachments' AS attachments
    FROM public.data_records r
    WHERE r.workspace_id = $1 AND r.entity = 'message'
      AND jsonb_path_exists(r.data, '$.attachments[*].xml')
      AND ($2::date IS NULL OR r.occurred_at >= $2::date)
    ORDER BY r.occurred_at DESC NULLS LAST
    LIMIT 200`

/** One mail record of the workspace. */
export const FIND_INVOICE_MAIL = sql`
    SELECT r.id, r.data -> 'attachments' AS attachments
    FROM public.data_records r
    WHERE r.workspace_id = $1 AND r.entity = 'message' AND r.id::text = $2`
