import { ADJUSTMENT, INVOICE, ORDER, TRANSACTION, adjustmentOf, invoiceOf, transactionOf } from "./accounting.fixtures"
import { ACCOUNTING_SETTINGS_DEFAULTS } from "./settings"
import { ledgerLineOf, postAdjustment, postInvoice, postTransaction } from "./posting"

const SETTINGS = ACCOUNTING_SETTINGS_DEFAULTS
const matched = transactionOf({ status: "matched", orderId: ORDER.id })

describe("posting", () => {
    it("posts matched money in as income on the shop day, noted with the payer and the transfer content", () => {
        expect(postTransaction(matched, SETTINGS)).toEqual([
            {
                kind: "income",
                sourceEntity: "payment.transaction",
                sourceId: TRANSACTION.id,
                entryDate: "2026-11-04",
                amountVnd: 5_000_000,
                note: "NGUYEN VAN DINH / NIVO8F3K2 chuyen tien",
                counterparty: "NGUYEN VAN DINH",
                status: "paid",
            },
        ])
    })

    it("names the note after the source when the transfer names nobody, so a list always has a title", () => {
        const [entry] = postTransaction({ ...matched, payer: null, reference: null }, SETTINGS)
        expect(entry?.note).toBe("payment.transaction")
        const [referenceOnly] = postTransaction({ ...matched, payer: "", reference: "ck" }, SETTINGS)
        expect(referenceOnly?.note).toBe("ck")
    })

    it("posts nothing for money nobody matched yet or money waiting for review, by default", () => {
        expect(postTransaction(TRANSACTION, SETTINGS)).toEqual([])
        expect(postTransaction(transactionOf({ status: "needs_review" }), SETTINGS)).toEqual([])
    })

    it("posts money nobody matched yet as income when the settings say so", () => {
        const settings = { ...SETTINGS, postUnmatched: true }
        expect(postTransaction(TRANSACTION, settings).map((entry) => entry.kind)).toEqual(["income"])
        expect(postTransaction(transactionOf({ status: "needs_review" }), settings).map((entry) => entry.kind)).toEqual(
            ["income"],
        )
    })

    it("posts money out as an expense, or nothing when the settings do not post expenses", () => {
        const out = { ...matched, direction: "debit" } as const
        expect(postTransaction(out, SETTINGS)).toMatchObject([{ kind: "expense", amountVnd: 5_000_000 }])
        expect(postTransaction(out, { ...SETTINGS, postExpenses: false })).toEqual([])
        expect(postTransaction({ ...out, status: "unmatched" }, SETTINGS)).toHaveLength(1)
    })

    it("posts an issued invoice as what is owed, dated by its issue", () => {
        expect(postInvoice(INVOICE, false, SETTINGS)).toEqual([
            {
                kind: "invoice",
                sourceEntity: "accounting.invoice",
                sourceId: INVOICE.id,
                entryDate: "2026-11-01",
                amountVnd: 2_000_000,
                note: "INV-202611-0001 / Nguy\u1ec5n V\u0103n \u0110\u1ecbnh",
                counterparty: INVOICE.customer,
                status: "open",
            },
        ])
    })

    it("dates an invoice never issued by its creation", () => {
        const [owed] = postInvoice(
            invoiceOf({ issuedAt: null, createdAt: "2026-10-30T20:00:00.000Z" }),
            false,
            SETTINGS,
        )
        expect(owed?.entryDate).toBe("2026-10-31")
    })

    it("posts a paid invoice no credit settled as owed and as income, dated by the payment", () => {
        const paid = invoiceOf({ status: "paid", paidAt: "2026-11-03T05:00:00.000Z" })
        const entries = postInvoice(paid, false, SETTINGS)
        expect(entries.map((entry) => [entry.kind, entry.entryDate])).toEqual([
            ["invoice", "2026-11-01"],
            ["income", "2026-11-03"],
        ])
    })

    it("dates that income by the issue, then the creation, when the payment time is unknown", () => {
        const [, byIssue] = postInvoice(invoiceOf({ status: "paid", paidAt: null }), false, SETTINGS)
        expect(byIssue?.entryDate).toBe("2026-11-01")
        const [, byCreation] = postInvoice(invoiceOf({ status: "paid", paidAt: null, issuedAt: null }), false, SETTINGS)
        expect(byCreation?.entryDate).toBe("2026-11-01")
    })

    it("leaves the income of a paid invoice to the credit that settled it", () => {
        expect(postInvoice(invoiceOf({ status: "paid" }), true, SETTINGS).map((entry) => entry.kind)).toEqual([
            "invoice",
        ])
    })

    it("posts only the income of a paid invoice when the settings do not post outgoing invoices", () => {
        const settings = { ...SETTINGS, postOutgoing: false }
        expect(postInvoice(INVOICE, false, settings)).toEqual([])
        expect(postInvoice(invoiceOf({ status: "paid" }), false, settings).map((entry) => entry.kind)).toEqual([
            "income",
        ])
    })

    it("posts nothing for a draft invoice", () => {
        expect(postInvoice(invoiceOf({ status: "draft" }), false, SETTINGS)).toEqual([])
    })

    it("reverses a void invoice that was issued, with a negative entry and never a delete", () => {
        expect(postInvoice(invoiceOf({ status: "void" }), false, SETTINGS)).toEqual([
            {
                kind: "reversal",
                sourceEntity: "accounting.invoice",
                sourceId: INVOICE.id,
                entryDate: "2026-11-01",
                amountVnd: -2_000_000,
                note: "INV-202611-0001 / Nguy\u1ec5n V\u0103n \u0110\u1ecbnh",
                counterparty: INVOICE.customer,
                status: "review",
            },
        ])
    })

    it("posts nothing for a void invoice that was never issued, when reversals are off, or when invoices are not posted", () => {
        expect(postInvoice(invoiceOf({ status: "void", issuedAt: null }), false, SETTINGS)).toEqual([])
        expect(postInvoice(invoiceOf({ status: "void" }), false, { ...SETTINGS, voidMode: "none" })).toEqual([])
        expect(postInvoice(invoiceOf({ status: "void" }), false, { ...SETTINGS, postOutgoing: false })).toEqual([])
    })

    it("posts a correction with its corrected amount and its author and note", () => {
        expect(postAdjustment(ADJUSTMENT)).toEqual({
            kind: "adjustment",
            sourceEntity: "accounting.adjustment",
            sourceId: ADJUSTMENT.id,
            entryDate: "2026-11-02",
            amountVnd: 1_800_000,
            note: "Lan / Gi\u1ea3m gi\u00e1 \u0111\u00e3 th\u1ecfa thu\u1eadn qua \u0111i\u1ec7n tho\u1ea1i",
            counterparty: null,
            status: "review",
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
