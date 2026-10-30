import { builder } from "@starci/jest-preset"
import { ordersEntities } from "@modules/domain/orders"
import type { SalesOrderListRow } from "@modules/domain/orders"

const [OrderEntity] = ordersEntities
type OrderRecord = InstanceType<typeof OrderEntity>
type SalesOrderRow = Omit<SalesOrderListRow, "contact_name" | "company">

/** An order row as the contract answers it. */
export const orderOf = builder<SalesOrderRow>({
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "DH-20261013-0001",
    items: "2 x Tea",
    amount_vnd: 90000,
    status: "draft",
    confirmed_by: null,
    confirmed_at: null,
    created_at: "2026-10-13T01:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
})

/** The instant of an ISO text, or null for no text. */
export const dateOf = (value: string | null): Date | null => (value === null ? null : new Date(value))

/** The stored order of a contract row. */
export const orderEntityOf = (row: SalesOrderRow): OrderRecord =>
    Object.assign(new OrderEntity(), {
        id: row.id,
        workspaceId: row.workspace_id,
        leadId: row.lead_id,
        inboundEventId: row.inbound_event_id,
        orderNo: row.order_no,
        items: row.items,
        amountVnd: row.amount_vnd,
        status: row.status,
        confirmedBy: row.confirmed_by,
        confirmedAt: dateOf(row.confirmed_at),
        createdAt: new Date(row.created_at),
        shippedAt: dateOf(row.shipped_at),
        carrier: row.carrier,
        trackingCode: row.tracking_code,
    })

/** What a write answers with `RETURNING *`: snake case columns, a bigint as text, instants as Dates. */
export const writtenOf = (row: SalesOrderRow) => ({
    ...row,
    amount_vnd: row.amount_vnd === null ? null : String(row.amount_vnd),
    confirmed_at: dateOf(row.confirmed_at),
    created_at: new Date(row.created_at),
    shipped_at: dateOf(row.shipped_at),
})

/** The customer card the leads owner answers for lead-1. */
export const MINH = { id: "lead-1", contactName: "Minh", company: "Tea Co", channel: "web", stage: "new", email: null }
