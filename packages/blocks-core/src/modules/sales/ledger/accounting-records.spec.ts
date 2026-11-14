import type { ListedRecord, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import {
    CLAIM_FIELDS,
    INVOICE_FIELDS,
    LEAD_NAME_FIELDS,
    ORDER_FIELDS,
    TRANSACTION_FIELDS,
    adjustmentOf,
    bookEntryOf,
    claimOf,
    invoiceOf,
    leadNameOf,
    openInvoiceOf,
    orderOf,
    transactionOf,
} from "./accounting-records"

const recordOf = (data: Readonly<Record<string, unknown>>): RecordRow => ({
    id: "r1",
    workspaceId: "w1",
    version: "4",
    createdAt: "2026-11-05T00:00:00.000Z",
    updatedAt: "2026-11-05T00:00:00.000Z",
    data,
})

const listedOf = (data: Readonly<Record<string, unknown>>, joined: ListedRecord["joined"] = {}): ListedRecord => ({
    row: recordOf(data),
    joined,
    position: [],
})

const TRANSACTION = {
    direction: "credit",
    amountVnd: 5_000_000,
    reference: "NIVO8F3K2",
    payer: "DINH",
    orderId: "o1",
    occurredAt: "2026-11-04T11:30:00.000Z",
    status: "matched",
}

const ORDER = { orderNo: "DH-1", amountVnd: 5_000_000, status: "confirmed" }

const CLAIM = { contactId: null, amountVnd: 5_000_000, status: "open", settledTransactionId: null }

const INVOICE = {
    invoiceNo: "HD-1",
    amountVnd: 2_000_000,
    status: "issued",
    dueAt: "2026-11-16T00:00:00.000Z",
    issuedAt: "2026-11-01T03:00:00.000Z",
    paidAt: null,
}

describe("transactionOf", () => {
    it("reads a payment record with its id and version", () => {
        expect(transactionOf(recordOf(TRANSACTION))).toEqual({ id: "r1", version: "4", ...TRANSACTION })
    })

    it("reads a nullable field the engine left out as null", () => {
        const { reference, payer, orderId, ...required } = TRANSACTION
        expect([reference, payer, orderId]).toHaveLength(3)
        expect(transactionOf(recordOf(required))).toMatchObject({ reference: null, payer: null, orderId: null })
    })

    it("refuses a record that is not a payment", () => {
        expect(transactionOf(recordOf({ ...TRANSACTION, status: "lost" }))).toBeNull()
        expect(transactionOf(recordOf({}))).toBeNull()
    })
})

describe("orderOf", () => {
    it("reads an order with the person it is for", () => {
        expect(orderOf(listedOf({ ...ORDER, contactId: "c1" }))).toEqual({
            id: "r1",
            version: "4",
            ...ORDER,
            contactId: "c1",
        })
    })

    it("reads an order with no person, and an amount the engine left out, as null", () => {
        const { amountVnd, ...unpriced } = ORDER
        expect(amountVnd).toBe(5_000_000)
        expect(orderOf(listedOf(unpriced))).toMatchObject({ amountVnd: null, contactId: null })
    })

    it("refuses a record that is not an order", () => {
        expect(orderOf(listedOf({ orderNo: "DH-1" }))).toBeNull()
    })
})

describe("claimOf", () => {
    it("reads a claim with the id of its order joined in and the id of its conversation as a plain field", () => {
        expect(claimOf(listedOf({ ...CLAIM, conversationId: "c1" }, { order: { id: "o1", data: {} } }))).toEqual({
            id: "r1",
            version: "4",
            ...CLAIM,
            orderId: "o1",
            conversationId: "c1",
        })
    })

    it("reads a claim with neither link", () => {
        expect(claimOf(listedOf(CLAIM))).toMatchObject({ orderId: null, conversationId: null })
    })

    it("refuses a record that is not a claim", () => {
        expect(claimOf(listedOf({ status: "gone" }))).toBeNull()
    })
})

describe("invoiceOf", () => {
    it("reads an invoice with the customer's name given and the time it was created", () => {
        expect(invoiceOf(listedOf(INVOICE), "Dinh")).toEqual({
            id: "r1",
            ...INVOICE,
            contactId: null,
            createdAt: "2026-11-05T00:00:00.000Z",
            customer: "Dinh",
        })
    })

    it("has no customer when none is given", () => {
        expect(invoiceOf(listedOf(INVOICE), null)).toMatchObject({ customer: null })
    })

    it("refuses a record that is not an invoice", () => {
        expect(invoiceOf(listedOf({ invoiceNo: "HD-1" }), null)).toBeNull()
    })
})

describe("openInvoiceOf", () => {
    it("keeps what the ageing reads of an open invoice", () => {
        expect(openInvoiceOf(recordOf(INVOICE))).toEqual({
            amountVnd: 2_000_000,
            dueAt: "2026-11-16T00:00:00.000Z",
            issuedAt: "2026-11-01T03:00:00.000Z",
            createdAt: "2026-11-05T00:00:00.000Z",
        })
        expect(openInvoiceOf(recordOf({}))).toBeNull()
    })
})

describe("adjustmentOf and bookEntryOf", () => {
    it("reads a correction with the time it was written", () => {
        const data = {
            targetType: "invoice",
            targetId: "i1",
            note: "Discount",
            correctedAmountVnd: 5,
            createdBy: "Lan",
        }
        expect(adjustmentOf(recordOf(data))).toEqual({ id: "r1", ...data, createdAt: "2026-11-05T00:00:00.000Z" })
        expect(adjustmentOf(recordOf({ ...data, correctedAmountVnd: undefined }))).toMatchObject({
            correctedAmountVnd: null,
        })
        expect(adjustmentOf(recordOf({ note: "x" }))).toBeNull()
    })

    it("reads a book entry with its version", () => {
        const data = {
            kind: "income",
            sourceEntity: "blocks-core.sales.transaction",
            sourceId: "t1",
            entryDate: "2026-11-04",
            amountVnd: 5,
            note: null,
            counterparty: null,
            status: "paid",
        }
        expect(bookEntryOf(recordOf(data))).toEqual({ id: "r1", version: "4", ...data })
        expect(bookEntryOf(recordOf({ kind: "tip" }))).toBeNull()
    })
})

describe("leadNameOf and the field lists", () => {
    it("reads the name of a customer", () => {
        expect(leadNameOf(recordOf({ contactName: "Dinh" }))).toBe("Dinh")
        expect(leadNameOf(recordOf({}))).toBeNull()
    })

    it("lists the declared fields each query selects", () => {
        expect(TRANSACTION_FIELDS).toContain("occurredAt")
        expect(ORDER_FIELDS).toEqual(["orderNo", "contactId", "amountVnd", "status"])
        expect(CLAIM_FIELDS).toContain("settledTransactionId")
        expect(INVOICE_FIELDS).toContain("dueAt")
        expect(LEAD_NAME_FIELDS).toEqual(["contactName"])
    })
})
