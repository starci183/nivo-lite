/** One selected column: the expression and the name it answers under. */
export type InvoiceColumn = readonly [expression: string, alias: string]

/** The columns of an invoice record; the amount is a number and the dates are database text, as the statements always answered. */
export const INVOICE_COLUMNS: ReadonlyArray<InvoiceColumn> = [
    ["i.id", "id"],
    ["i.workspaceId", "workspace_id"],
    ["i.orderId", "order_id"],
    ["i.leadId", "lead_id"],
    ["i.invoiceNo", "invoice_no"],
    ["i.amount_vnd::float8", "amount_vnd"],
    ["i.status", "status"],
    ["i.issuedBy", "issued_by"],
    ["i.paid_at::text", "paid_at"],
    ["i.contractId", "contract_id"],
    ["i.period_ends_on::text", "period_ends_on"],
]

/** The columns of an invoice the Sales and accounting views read: the dates as ISO text. */
export const INVOICE_VIEW_COLUMNS: ReadonlyArray<InvoiceColumn> = [
    ["i.id", "id"],
    ["i.workspaceId", "workspace_id"],
    ["i.orderId", "order_id"],
    ["i.leadId", "lead_id"],
    ["i.invoiceNo", "invoice_no"],
    ["i.amount_vnd::float8", "amount_vnd"],
    ["i.status", "status"],
    ["i.issuedBy", "issued_by"],
    ["to_json(i.paid_at) #>> '{}'", "paid_at"],
    ["i.contractId", "contract_id"],
    ["to_json(i.period_ends_on) #>> '{}'", "period_ends_on"],
    ["to_json(i.due_at) #>> '{}'", "due_at"],
    ["to_json(i.issued_at) #>> '{}'", "issued_at"],
    ["to_json(i.created_at) #>> '{}'", "created_at"],
]

/** The `RETURNING` clause of a statement that answers the invoice it wrote. */
export const INVOICE_RETURNING =
    "id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, issued_by, paid_at::text AS paid_at, contract_id, period_ends_on::text AS period_ends_on"

/** The part of a typeorm select query that picks columns: each call answers the query itself. */
export interface ColumnSelection<Query> {
    /** Replaces the selection. */
    select(expression: string, alias: string): Query
    /** Adds to the selection. */
    addSelect(expression: string, alias: string): Query
}

/** Selects the columns on a query, the first one replacing any earlier selection. */
export const selectColumns = <Query extends ColumnSelection<Query>>(
    query: Query,
    columns: ReadonlyArray<InvoiceColumn>,
): Query =>
    columns.reduce(
        (selected, [expression, alias], index) =>
            index === 0 ? selected.select(expression, alias) : selected.addSelect(expression, alias),
        query,
    )
