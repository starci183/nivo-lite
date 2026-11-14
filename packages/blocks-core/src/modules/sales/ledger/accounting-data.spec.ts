import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import {
    ADJUSTMENT,
    CLAIM,
    INVOICE,
    ORDER,
    TRANSACTION,
    adjustmentOf as adjustmentRecord,
    invoiceOf as invoiceRecord,
} from "../../../rules/sales/ledger/accounting.fixtures"
import {
    adjustmentById,
    adjustmentsOf,
    bookEntryById,
    bookTotals,
    claimById,
    escalatedClaims,
    invoiceById,
    leadNameOfContact,
    openInvoices,
    orderById,
    settlesInvoice,
    targetExists,
    transactionById,
    unmatchedIn,
} from "./accounting-data"
import {
    entityApi,
    memoryWorld,
    putAdjustment,
    putBookEntry,
    putClaim,
    putInvoice,
    putLead,
    putOrder,
    putRecord,
    putTransaction,
} from "./fixtures/accounting.memory"

const LEAD = "lead-1"

/** The person of the order and the invoice. */
const CONTACT = ORDER.contactId ?? "contact"

const ENTRY = {
    id: "e1",
    version: "1",
    kind: "income",
    sourceEntity: "blocks-core.sales.transaction",
    sourceId: TRANSACTION.id,
    entryDate: "2026-11-04",
    amountVnd: 100,
    note: null,
    counterparty: null,
    status: "paid",
} as const

const RANGE = { fromIso: "2026-11-01T00:00:00.000Z", toIso: "2026-12-01T00:00:00.000Z" }

const idOf = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

describe("reading one record", () => {
    it("reads a payment, and nothing for a record that is not there or is not a payment", async () => {
        const world = memoryWorld()
        putTransaction(world, TRANSACTION)
        putRecord(world, "blocks-core.sales.transaction", "bad", { status: "lost" })
        const api = entityApi(world, "blocks-core.sales.transaction")
        await expect(transactionById(api, TRANSACTION.id)).resolves.toEqual(TRANSACTION)
        await expect(transactionById(api, "nope")).resolves.toBeNull()
        await expect(transactionById(api, "bad")).resolves.toBeNull()
    })

    it("reads an order with the id of its lead", async () => {
        const world = memoryWorld()
        putOrder(world, ORDER)
        const api = entityApi(world, "blocks-core.sales.order")
        await expect(orderById(api, ORDER.id)).resolves.toEqual(ORDER)
        await expect(orderById(api, "nope")).resolves.toBeNull()
    })

    it("reads a claim with the ids of its order and conversation", async () => {
        const world = memoryWorld()
        putOrder(world, ORDER)
        putClaim(world, CLAIM)
        const api = entityApi(world, "blocks-core.sales.claim")
        await expect(claimById(api, CLAIM.id)).resolves.toEqual(CLAIM)
        await expect(claimById(api, "nope")).resolves.toBeNull()
    })

    it("reads an invoice with its customer's name", async () => {
        const world = memoryWorld()
        putLead(world, LEAD, INVOICE.customer ?? "", CONTACT)
        putInvoice(world, { ...INVOICE, contactId: CONTACT })
        const api = entityApi(world, "blocks-core.sales.invoice")
        const leads = entityApi(world, "blocks-core.sales.lead")
        await expect(invoiceById(api, leads, INVOICE.id)).resolves.toEqual({ ...INVOICE, contactId: CONTACT })
        await expect(invoiceById(api, leads, "nope")).resolves.toBeNull()
    })

    it("reads a correction, a book entry and the name of a customer", async () => {
        const world = memoryWorld()
        putAdjustment(world, ADJUSTMENT)
        putBookEntry(world, ENTRY)
        putLead(world, LEAD, "Dinh", CONTACT)
        await expect(adjustmentById(entityApi(world, "blocks-core.sales.ledger-adjustment"), ADJUSTMENT.id)).resolves.toEqual(
            ADJUSTMENT,
        )
        await expect(adjustmentById(entityApi(world, "blocks-core.sales.ledger-adjustment"), "nope")).resolves.toBeNull()
        await expect(bookEntryById(entityApi(world, "blocks-core.sales.ledger-entry"), "e1")).resolves.toEqual(ENTRY)
        await expect(bookEntryById(entityApi(world, "blocks-core.sales.ledger-entry"), "nope")).resolves.toBeNull()
        await expect(leadNameOfContact(entityApi(world, "blocks-core.sales.lead"), CONTACT)).resolves.toBe("Dinh")
        await expect(leadNameOfContact(entityApi(world, "blocks-core.sales.lead"), "nope")).resolves.toBeNull()
        await expect(leadNameOfContact(entityApi(world, "blocks-core.sales.lead"), null)).resolves.toBeNull()
    })
})

describe("the corrections of a record", () => {
    it("lists those that point at it, oldest first, and skips a record that is no correction", async () => {
        const world = memoryWorld()
        putAdjustment(world, adjustmentRecord({ id: "a2", createdAt: "2026-11-03T00:00:00.000Z" }))
        putAdjustment(world, adjustmentRecord({ id: "a1", createdAt: "2026-11-02T00:00:00.000Z" }))
        putAdjustment(world, adjustmentRecord({ id: "a3", targetId: "elsewhere" }))
        putRecord(world, "blocks-core.sales.ledger-adjustment", "a4", { targetType: "invoice", targetId: INVOICE.id, note: 1 })
        const found = await adjustmentsOf(entityApi(world, "blocks-core.sales.ledger-adjustment"), "invoice", INVOICE.id)
        expect(found.map((adjustment) => adjustment.id)).toEqual(["a1", "a2"])
    })

    it("tells whether the invoice or the payment it points at exists", async () => {
        const world = memoryWorld()
        putTransaction(world, TRANSACTION)
        putInvoice(world, INVOICE)
        const stores = {
            invoices: entityApi(world, "blocks-core.sales.invoice"),
            transactions: entityApi(world, "blocks-core.sales.transaction"),
        }
        await expect(targetExists(stores, "invoice", INVOICE.id)).resolves.toBe(true)
        await expect(targetExists(stores, "invoice", TRANSACTION.id)).resolves.toBe(false)
        await expect(targetExists(stores, "transaction", TRANSACTION.id)).resolves.toBe(true)
        await expect(targetExists(stores, "transaction", INVOICE.id)).resolves.toBe(false)
    })
})

describe("the figures of the books", () => {
    it("counts and sums the unmatched payments of a range, and answers zero for none", async () => {
        const world = memoryWorld()
        putTransaction(world, { ...TRANSACTION, id: "t1", amountVnd: 100 })
        putTransaction(world, { ...TRANSACTION, id: "t2", amountVnd: 50, status: "needs_review" })
        putTransaction(world, { ...TRANSACTION, id: "t3", status: "matched" })
        putTransaction(world, { ...TRANSACTION, id: "t4", occurredAt: "2026-12-02T00:00:00.000Z" })
        const api = entityApi(world, "blocks-core.sales.transaction")
        await expect(unmatchedIn(api, RANGE)).resolves.toEqual({ count: 2, vnd: 150 })
        await expect(
            unmatchedIn(api, { fromIso: "2027-01-01T00:00:00.000Z", toIso: "2027-02-01T00:00:00.000Z" }),
        ).resolves.toEqual({ count: 0, vnd: 0 })
    })

    it("reads a measure that travels as text, and one that is no number as zero", async () => {
        const stub: EntityApi = {
            ...entityApi(memoryWorld(), "blocks-core.sales.transaction"),
            aggregate: () => Promise.resolve([{ groups: {}, measures: { count: "3", vnd: "abc" } }]),
        }
        await expect(unmatchedIn(stub, RANGE)).resolves.toEqual({ count: 3, vnd: 0 })
        const empty: EntityApi = { ...stub, aggregate: () => Promise.resolve([]) }
        await expect(unmatchedIn(empty, RANGE)).resolves.toEqual({ count: 0, vnd: 0 })
    })

    it("tells whether a payment settled an invoice", async () => {
        const world = memoryWorld()
        putRecord(world, "blocks-core.sales.transaction", "t1", { ...TRANSACTION, invoiceId: INVOICE.id })
        const api = entityApi(world, "blocks-core.sales.transaction")
        await expect(settlesInvoice(api, INVOICE.id)).resolves.toBe(true)
        await expect(settlesInvoice(api, "other")).resolves.toBe(false)
    })

    it("sums the book of a range of days by kind", async () => {
        const world = memoryWorld()
        putBookEntry(world, { ...ENTRY, id: "e1", amountVnd: 100 })
        putBookEntry(world, { ...ENTRY, id: "e2", amountVnd: 20 })
        putBookEntry(world, { ...ENTRY, id: "e3", kind: "invoice", amountVnd: 7 })
        putBookEntry(world, { ...ENTRY, id: "e4", entryDate: "2026-12-01", amountVnd: 1_000 })
        const api = entityApi(world, "blocks-core.sales.ledger-entry")
        await expect(bookTotals(api, { fromDay: "2026-11-01", toDay: "2026-12-01" })).resolves.toEqual([
            { kind: "income", vnd: 120, count: 2 },
            { kind: "invoice", vnd: 7, count: 1 },
        ])
    })

    it("leaves out a group of the totals that is no kind of entry", async () => {
        const stub: EntityApi = {
            ...entityApi(memoryWorld(), "blocks-core.sales.ledger-entry"),
            aggregate: () =>
                Promise.resolve([
                    { groups: { kind: "tip" }, measures: { vnd: 1, count: 1 } },
                    { groups: { kind: "adjustment" }, measures: { vnd: 2, count: 1 } },
                ]),
        }
        await expect(bookTotals(stub, { fromDay: "2026-11-01", toDay: "2026-12-01" })).resolves.toEqual([
            { kind: "adjustment", vnd: 2, count: 1 },
        ])
    })

    it("counts the claims the graph escalated to the owner", async () => {
        const world = memoryWorld()
        putClaim(world, { ...CLAIM, id: "c1", status: "escalated" })
        putClaim(world, { ...CLAIM, id: "c2", status: "escalated" })
        putClaim(world, { ...CLAIM, id: "c3" })
        await expect(escalatedClaims(entityApi(world, "blocks-core.sales.claim"))).resolves.toBe(2)
    })
})

describe("the open invoices", () => {
    const invoicesWorld = (count: number) => {
        const world = memoryWorld()
        for (let n = 1; n <= count; n += 1)
            putInvoice(
                world,
                invoiceRecord({ id: idOf(n), createdAt: `2026-11-01T00:${String(n % 60).padStart(2, "0")}:00.000Z` }),
            )
        putInvoice(world, invoiceRecord({ id: idOf(9_000), status: "paid" }))
        putRecord(world, "blocks-core.sales.invoice", idOf(9_001), { status: "issued", amountVnd: "x" })
        return entityApi(world, "blocks-core.sales.invoice")
    }

    it("reads every page of them until none is left", async () => {
        const open = await openInvoices(invoicesWorld(250), 1_000)
        expect(open).toHaveLength(250)
        expect(open[0]).toMatchObject({
            amountVnd: INVOICE.amountVnd,
            dueAt: INVOICE.dueAt,
            issuedAt: INVOICE.issuedAt,
        })
        expect(typeof open[0]?.createdAt).toBe("string")
    })

    it("stops at the limit", async () => {
        await expect(openInvoices(invoicesWorld(250), 120)).resolves.toHaveLength(120)
    })
})
