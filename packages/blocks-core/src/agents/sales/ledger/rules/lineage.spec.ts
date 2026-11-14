import { ADJUSTMENT, INVOICE, ORDER, TRANSACTION, adjustmentOf, transactionOf } from "./accounting.fixtures"
import { lineageOf } from "./lineage"

describe("lineage", () => {
    it("lists order, invoice, payment and correction in the order the money moved", () => {
        const steps = lineageOf({
            order: ORDER,
            invoice: INVOICE,
            transaction: TRANSACTION,
            adjustments: [ADJUSTMENT],
        })
        expect(steps.map((step) => [step.kind, step.title, step.amount])).toEqual([
            ["order", "DH-20261104-0001", 5_000_000],
            ["invoice", "INV-202611-0001", 2_000_000],
            ["payment", "NGUYEN VAN DINH", 5_000_000],
            ["adjustment", "Lan", 1_800_000],
        ])
        expect(steps[3]).toMatchObject({
            detail: "Gi\u1ea3m gi\u00e1 \u0111\u00e3 th\u1ecfa thu\u1eadn qua \u0111i\u1ec7n tho\u1ea1i",
            status: null,
        })
        expect(steps.map((step) => step.id)).toEqual([ORDER.id, INVOICE.id, TRANSACTION.id, ADJUSTMENT.id])
    })

    it("orders corrections by time, and draws an unpriced order without an amount", () => {
        const later = adjustmentOf({ id: "a2", createdAt: "2026-11-03T04:00:00.000Z", createdBy: "Minh" })
        const steps = lineageOf({
            order: { ...ORDER, amountVnd: null },
            invoice: null,
            transaction: null,
            adjustments: [later, ADJUSTMENT],
        })
        expect(steps.map((step) => step.title)).toEqual(["DH-20261104-0001", "Lan", "Minh"])
        expect(steps[0]?.amount).toBeNull()
    })

    it("falls back to the transfer content, then a dash, for a payment with no payer, and to the creation for an invoice not issued", () => {
        const [byReference] = lineageOf({
            order: null,
            invoice: null,
            transaction: transactionOf({ payer: null }),
            adjustments: [],
        })
        expect(byReference?.title).toBe("NIVO8F3K2 chuyen tien")
        const [dash] = lineageOf({
            order: null,
            invoice: null,
            transaction: transactionOf({ payer: null, reference: null }),
            adjustments: [],
        })
        expect(dash?.title).toBe("-")
        const [invoice] = lineageOf({
            order: null,
            invoice: { ...INVOICE, issuedAt: null },
            transaction: null,
            adjustments: [],
        })
        expect(invoice?.at).toBe(INVOICE.createdAt)
    })

    it("is empty when nothing is known", () => {
        expect(lineageOf({ order: null, invoice: null, transaction: null, adjustments: [] })).toEqual([])
    })
})
