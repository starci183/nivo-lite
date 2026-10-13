import { toPaymentOrder } from "./payment-orders.mapper"
import type { OrderRow } from "./persistence/payment-orders.rows"

const ROW: OrderRow = {
    id: "order-1",
    workspace_id: "ws-1",
    plan_code: "starter",
    amount_vnd: 990000,
    order_code: "NIVO8F3K2",
    status: "pending",
    expires_at: "2026-10-12T10:30:00+00:00",
    paid_at: null,
    created_at: "2026-10-12T10:00:00+00:00",
    kind: "topup",
    pack_code: "credits_1000",
    detail: { credits: 1000 },
}

describe("payment orders mapper", () => {
    it("maps the columns to the order, instants as ISO text", () => {
        expect(toPaymentOrder(ROW)).toEqual({
            id: "order-1",
            workspaceId: "ws-1",
            planCode: "starter",
            amountVnd: 990000,
            orderCode: "NIVO8F3K2",
            status: "pending",
            expiresAt: "2026-10-12T10:30:00.000Z",
            paidAt: null,
            createdAt: "2026-10-12T10:00:00.000Z",
            kind: "topup",
            packCode: "credits_1000",
            detail: { credits: 1000 },
        })
    })

    it("keeps the instant a paid order was settled", () => {
        expect(toPaymentOrder({ ...ROW, paid_at: "2026-10-12T10:05:00+00:00" }).paidAt).toBe("2026-10-12T10:05:00.000Z")
    })

    it.each([[[1]], ["text"], [5]])("counts the stored detail %p as no detail", (detail) => {
        expect(toPaymentOrder({ ...ROW, detail }).detail).toEqual({})
    })
})
