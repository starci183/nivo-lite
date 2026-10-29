import type { PayableOrder } from "@modules/domain/billing"
import { PaymentOrderRequestEntity } from "@modules/domain/payment-order-requests"

export const PAYLOAD = { requestId: "request-1", workspaceId: "ws-1" }
/** A stored request as the specs write it. */
export interface StoredRequest {
    readonly id: string
    readonly workspace_id: string
    readonly requested_by: string
    readonly kind: PaymentOrderRequestEntity["kind"]
    readonly target: string | null
    readonly cycle: PaymentOrderRequestEntity["cycle"]
    readonly tier_credits: number | null
    readonly seats: number | null
    readonly status: PaymentOrderRequestEntity["status"]
}

/** The entity of a stored request. */
export const entityOf = (row: StoredRequest): PaymentOrderRequestEntity =>
    Object.assign(new PaymentOrderRequestEntity(), {
        id: row.id,
        workspaceId: row.workspace_id,
        requestedBy: row.requested_by,
        kind: row.kind,
        target: row.target,
        cycle: row.cycle,
        tierCredits: row.tier_credits,
        seats: row.seats,
        status: row.status,
    })

export const REQUEST: StoredRequest = {
    id: "request-1",
    workspace_id: "ws-1",
    requested_by: "person-1",
    kind: "plan",
    target: "starter",
    cycle: null,
    tier_credits: null,
    seats: null,
    status: "pending",
}
export const PAYABLE: PayableOrder = {
    order: {
        id: "order-1",
        workspaceId: "ws-1",
        planCode: "starter",
        amountVnd: 990000,
        orderCode: "NIVO8F3K2",
        status: "pending",
        expiresAt: "2026-10-12T10:30:00.000Z",
        paidAt: null,
        createdAt: "2026-10-12T10:00:00.000Z",
        kind: "plan",
        packCode: null,
        detail: {},
    },
    qrUrl: "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=990000&des=NIVO8F3K2&template=compact",
    bank: { account: "0123", bank: "MB", holder: "NIVO" },
}

/** The stubs of a request answered once: its stored row is read, then its answer is written. */
export const answered = (stored: StoredRequest = REQUEST) =>
    ({
        findOne: [PaymentOrderRequestEntity, entityOf(stored)],
        update: [PaymentOrderRequestEntity, { affected: 1 }],
    }) as const
