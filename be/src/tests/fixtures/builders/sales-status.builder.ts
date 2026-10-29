import { builder } from "@starci/jest-preset"

/** An order as the sales status reads it: the order contract's row. */
export interface StatusOrderRow {
    readonly id: string
    readonly workspace_id: string
    readonly lead_id: string | null
    readonly inbound_event_id: string | null
    readonly order_no: string
    readonly items: string
    readonly amount_vnd: number | null
    readonly status: string
    readonly confirmed_by: string | null
    readonly confirmed_at: string | null
    readonly created_at: string
    readonly shipped_at: string | null
    readonly carrier: string | null
    readonly tracking_code: string | null
}

const orderRow = builder<StatusOrderRow>({
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: null,
    inbound_event_id: null,
    order_no: "DH-1",
    items: "2 chairs",
    amount_vnd: null,
    status: "confirmed",
    confirmed_by: null,
    confirmed_at: null,
    created_at: "2026-10-12T03:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
})

/** Order `order-1` of the first workspace, shipped at the given instant (null: not shipped yet). */
export const orderShippedAt = (shippedAt: string | null): StatusOrderRow => orderRow({ shipped_at: shippedAt })
