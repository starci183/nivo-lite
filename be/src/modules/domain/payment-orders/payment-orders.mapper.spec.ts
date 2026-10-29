import { Test } from "@nestjs/testing"
import { toPaymentOrder } from "./payment-orders.mapper"
import { PaymentOrderEntity } from "./persistence/entities"

const ROW: PaymentOrderEntity = Object.assign(new PaymentOrderEntity(), {
    id: "order-1",
    workspaceId: "ws-1",
    planCode: "starter",
    amountVnd: 990000,
    orderCode: "NIVO8F3K2",
    status: "pending",
    expiresAt: new Date("2026-10-12T10:30:00+00:00"),
    paidAt: null,
    createdAt: new Date("2026-10-12T10:00:00+00:00"),
    kind: "topup",
    packCode: "credits_1000",
    detail: { credits: 1000 },
})

const SUBJECT = Symbol("payment-orders.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toPaymentOrder } }],
    }).compile()
    return moduleRef.get<{ toPaymentOrder: typeof toPaymentOrder }>(SUBJECT)
}

describe("payment orders mapper", () => {
    it("maps the columns to the order, instants as ISO text", async () => {
        const subject = await buildSubject()

        expect(subject.toPaymentOrder(ROW)).toEqual({
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

    it("keeps the instant a paid order was settled", async () => {
        const subject = await buildSubject()

        expect(
            subject.toPaymentOrder(
                Object.assign(new PaymentOrderEntity(), ROW, { paidAt: new Date("2026-10-12T10:05:00+00:00") }),
            ).paidAt,
        ).toBe("2026-10-12T10:05:00.000Z")
    })

    it.each([[[1]], ["text"], [5]])("counts the stored detail %p as no detail", async (detail) => {
        const subject = await buildSubject()

        expect(subject.toPaymentOrder(Object.assign(new PaymentOrderEntity(), ROW, { detail })).detail).toEqual({})
    })

    it("keeps only plain values of the stored detail", async () => {
        const subject = await buildSubject()
        const detail = { credits: 5, from: "starter", promo: true, none: null, nested: { a: 1 }, list: [1] }

        expect(subject.toPaymentOrder(Object.assign(new PaymentOrderEntity(), ROW, { detail })).detail).toEqual({
            credits: 5,
            from: "starter",
            promo: true,
            none: null,
        })
    })
})
