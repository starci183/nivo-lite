import { Test } from "@nestjs/testing"

import type { PayableOrder } from "./billing.contracts"

import { paymentInstructionsOf as realPaymentInstructionsOf } from "./billing-payment-order.mapper"

const SUBJECT = Symbol("billing-payment-order.mapper")

type Subject = {
    paymentInstructionsOf: typeof realPaymentInstructionsOf
}

const ORDER: PayableOrder = {
    order: {
        id: "order-1",
        workspaceId: "ws-1",
        planCode: "team",
        amountVnd: 250000,
        orderCode: "NIVO123",
        status: "pending",
        expiresAt: "2026-10-15T00:00:00.000Z",
        paidAt: null,
        createdAt: "2026-10-14T00:00:00.000Z",
        kind: "upgrade",
        packCode: null,
        detail: {},
    },
    qrUrl: "https://qr.example/order-1",
    bank: { bank: "VCB", account: "123456", holder: "NIVO" },
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { paymentInstructionsOf: realPaymentInstructionsOf } }],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)

    return { subject }
}

describe("paymentInstructionsOf", () => {
    it("preserves the order and receiving instructions while retaining every correctly typed frozen detail", async () => {
        const { subject } = await buildSubject()

        const detail = {
            credits: 5000,
            from: "starter",
            to: "team",
            fromPrice: 100000,
            toPrice: 250000,
            credit: 75000,
            daysLeft: 15,
            paidUntil: "2026-11-01T00:00:00.000Z",
            cycle: "annual",
            tierCredits: 10000,
            seats: 3,
            promo: true,
        }
        const result = subject.paymentInstructionsOf({ ...ORDER, order: { ...ORDER.order, detail } })

        expect(result).toEqual({ ...ORDER.order, qrUrl: ORDER.qrUrl, bank: ORDER.bank, detail })
        expect(result.bank).not.toBe(ORDER.bank)
        expect(result.detail).not.toBe(detail)
    })

    it.each([
        {},
        {
            credits: "5000",
            from: 1,
            to: false,
            fromPrice: "100000",
            toPrice: true,
            credit: null,
            daysLeft: "15",
            paidUntil: 123,
            cycle: false,
            tierCredits: "10000",
            seats: "3",
            promo: "true",
        },
    ])("answers null for absent or incorrectly typed details %p", async (detail) => {
        const { subject } = await buildSubject()

        expect(subject.paymentInstructionsOf({ ...ORDER, order: { ...ORDER.order, detail } }).detail).toEqual({
            credits: null,
            from: null,
            to: null,
            fromPrice: null,
            toPrice: null,
            credit: null,
            daysLeft: null,
            paidUntil: null,
            cycle: null,
            tierCredits: null,
            seats: null,
            promo: null,
        })
    })
})

describe("paymentInstructionsOf", () => {
    it.each([0, -100])(
        "omits a nonpositive tier allowance %p while preserving zero and false sale details",
        async (tierCredits) => {
            const { subject } = await buildSubject()

            const detail = {
                credits: 0,
                from: "",
                to: "",
                fromPrice: 0,
                toPrice: 0,
                credit: 0,
                daysLeft: 0,
                paidUntil: "",
                cycle: "",
                tierCredits,
                seats: 0,
                promo: false,
            }

            expect(subject.paymentInstructionsOf({ ...ORDER, order: { ...ORDER.order, detail } }).detail).toEqual({
                ...detail,
                tierCredits: null,
            })
        },
    )
})
