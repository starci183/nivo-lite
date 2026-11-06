import { ADJUSTMENT, INVOICE, ORDER, TRANSACTION, adjustmentOf, invoiceOf, transactionOf } from "./accounting.fixtures"
import { ledgerLineOf, postAdjustment, postInvoice, postTransaction } from "./posting"

const matched = transactionOf({ status: "matched", orderId: ORDER.id })

describe("posting", () => {
    it("posts matched money in as income on the shop day, noted with the payer and the transfer content", () => {
        expect(postTransaction(matched)).toEqual([
            {
                kind: "income",
                sourceEntity: "payment.transaction",
                sourceId: TRANSACTION.id,
                entryDate: "2026-11-04",
                amountVnd: 5_000_000,
                note: "NGUYEN VAN DINH / NIVO8F3K2 chuyen tien",
            },
        ])
    })

    it("notes the entity of the payment when the transfer names nobody, so a list always has a title", () => {
        const [entry] = postTransaction({ ...matched, payer: null, reference: null })
        expect(entry?.note).toBe("payment.transaction")
        const [referenceOnly] = postTransaction({ ...matched, payer: "", reference: "ck" })
        expect(referenceOnly?.note).toBe("ck")
    })

    it("posts nothing for money nobody matched yet, money waiting for review or money out", () => {
        expect(postTransaction(TRANSACTION)).toEqual([])
        expect(postTransaction(transactionOf({ status: "needs_review" }))).toEqual([])
        expect(postTransaction({ ...matched, direction: "debit" })).toEqual([])
    })

    it("posts an issued invoice as what is owed, dated by its issue", () => {
        expect(postInvoice(INVOICE, false)).toEqual([
            {
                kind: "invoice",
                sourceEntity: "accounting.invoice",
                sourceId: INVOICE.id,
                entryDate: "2026-11-01",
                amountVnd: 2_000_000,
                note: "INV-202611-0001 / Nguyen Van Dinh",
            },
        ])
    })

    it("dates an invoice never issued by its creation", () => {
        const [owed] = postInvoice(invoiceOf({ issuedAt: null, createdAt: "2026-10-30T20:00:00.000Z" }), false)
        expect(owed?.entryDate).toBe("2026-10-31")
    })

    it("posts a paid invoice no credit settled as owed and as income, dated by the payment", () => {
        const paid = invoiceOf({ status: "paid", paidAt: "2026-11-03T05:00:00.000Z" })
        const entries = postInvoice(paid, false)
        expect(entries.map((entry) => [entry.kind, entry.entryDate])).toEqual([
            ["invoice", "2026-11-01"],
            ["income", "2026-11-03"],
        ])
    })

    it("dates that income by the issue, then the creation, when the payment time is unknown", () => {
        const [, byIssue] = postInvoice(invoiceOf({ status: "paid", paidAt: null }), false)
        expect(byIssue?.entryDate).toBe("2026-11-01")
        const [, byCreation] = postInvoice(invoiceOf({ status: "paid", paidAt: null, issuedAt: null }), false)
        expect(byCreation?.entryDate).toBe("2026-11-01")
    })

    it("leaves the income of a paid invoice to the credit that settled it", () => {
        expect(postInvoice(invoiceOf({ status: "paid" }), true).map((entry) => entry.kind)).toEqual(["invoice"])
    })

    it("posts nothing for a draft or a void invoice", () => {
        expect(postInvoice(invoiceOf({ status: "draft" }), false)).toEqual([])
        expect(postInvoice(invoiceOf({ status: "void" }), false)).toEqual([])
    })

    it("posts a correction with its corrected amount and its author and note", () => {
        expect(postAdjustment(ADJUSTMENT)).toEqual({
            kind: "adjustment",
            sourceEntity: "accounting.adjustment",
            sourceId: ADJUSTMENT.id,
            entryDate: "2026-11-02",
            amountVnd: 1_800_000,
            note: "Lan / Discount agreed by phone",
        })
    })

    it("posts a correction that only carries a note for nothing", () => {
        expect(postAdjustment(adjustmentOf({ correctedAmountVnd: null })).amountVnd).toBe(0)
    })

    it("writes the ledger line of a transaction that paid an order, naming the lead, else the payer, else nobody", () => {
        expect(ledgerLineOf(matched, ORDER, "Bui Nguyen Dinh")).toEqual({
            date: "2026-11-04",
            orderNo: "DH-20261104-0001",
            customer: "Bui Nguyen Dinh",
            amountVnd: 5_000_000,
            transactionId: TRANSACTION.id,
            status: "paid",
            note: "",
        })
        expect(ledgerLineOf(matched, ORDER, null).customer).toBe("NGUYEN VAN DINH")
        expect(ledgerLineOf({ ...matched, payer: null }, ORDER, null).customer).toBe("")
    })
})
