import { sql } from "@modules/platform/database"

/** The workspace's invoices for Sales handoffs ($1 workspace, $2 limit). */
export const LIST_WORKBENCH_INVOICES = sql`
    SELECT id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd,
           status, issued_by, to_json(paid_at) #>> '{}' AS paid_at,
           contract_id, to_json(period_ends_on) #>> '{}' AS period_ends_on,
           to_json(due_at) #>> '{}' AS due_at, to_json(issued_at) #>> '{}' AS issued_at,
           to_json(created_at) #>> '{}' AS created_at
    FROM public.invoices WHERE workspace_id = $1::uuid
    ORDER BY created_at ASC, id ASC LIMIT $2::int`

/** A customer's invoices, in creation order ($1 workspace, $2 lead). */
export const LIST_LEAD_INVOICES = sql`
    SELECT id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd,
           status, issued_by, to_json(paid_at) #>> '{}' AS paid_at,
           contract_id, to_json(period_ends_on) #>> '{}' AS period_ends_on,
           to_json(due_at) #>> '{}' AS due_at, to_json(issued_at) #>> '{}' AS issued_at,
           to_json(created_at) #>> '{}' AS created_at
    FROM public.invoices WHERE workspace_id = $1::uuid AND lead_id = $2::uuid
    ORDER BY created_at ASC, id ASC LIMIT 1000`
