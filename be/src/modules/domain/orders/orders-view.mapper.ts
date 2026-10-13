import type { SalesOrderRow } from "./persistence/orders.rows"
import type { SalesOrderView } from "./orders.contracts"

const instantOf = (value: string | Date): string => (value instanceof Date ? value.toISOString() : value)
const optionalInstantOf = (value: string | Date | null): string | null => (value === null ? null : instantOf(value))

/** Maps a persisted order to its workspace read view. */
export const toSalesOrderView = (result: SalesOrderRow): SalesOrderView => ({
    id: result.id,
    workspaceId: result.workspace_id,
    leadId: result.lead_id,
    orderNo: result.order_no,
    items: result.items,
    amountVnd: result.amount_vnd,
    status: result.status,
    origin: result.origin,
    confirmedBy: result.confirmed_by,
    confirmedAt: optionalInstantOf(result.confirmed_at),
    createdAt: instantOf(result.created_at),
    shippedAt: optionalInstantOf(result.shipped_at),
    carrier: result.carrier,
    trackingCode: result.tracking_code,
})
