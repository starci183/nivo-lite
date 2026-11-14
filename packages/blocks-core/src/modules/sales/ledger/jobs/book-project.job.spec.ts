import {
    ADJUSTMENT,
    INVOICE,
    ORDER,
    TRANSACTION,
    invoiceOf,
    transactionOf,
} from "../../../../rules/sales/ledger/accounting.fixtures"
import {
    entityApi,
    memoryWorld,
    putAdjustment,
    putInvoice,
    putLead,
    putRecord,
    putSettings,
    putTransaction,
    rowsOf,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { bookProjectJob } from "./book-project.job"

const CONTEXT = { workspaceId: "w1", attempt: 1, effectKey: (step: string): string => step }
const SETTLED = "00000000-0000-4000-8000-0000000000f2"
const GONE = "7f0f0f0f-0000-4000-8000-000000000001"

type Source = "blocks-core.sales.transaction" | "blocks-core.sales.invoice" | "blocks-core.sales.ledger-adjustment"

const worldOf = (): MemoryWorld => {
    const world = memoryWorld()
    putTransaction(world, transactionOf({ status: "matched", orderId: ORDER.id }))
    putInvoice(world, INVOICE)
    putInvoice(world, invoiceOf({ id: SETTLED, status: "paid", paidAt: "2026-11-02T03:00:00.000Z" }))
    putRecord(world, "blocks-core.sales.transaction", "00000000-0000-4000-8000-0000000000a9", {
        direction: "credit",
        amountVnd: 2_000_000,
        occurredAt: "2026-11-02T03:00:00.000Z",
        status: "matched",
        invoiceId: SETTLED,
    })
    putAdjustment(world, ADJUSTMENT)
    return world
}

const run = (world: MemoryWorld, sourceEntity: Source, sourceId: string): Promise<void> =>
    bookProjectJob.run(
        {
            transactions: entityApi(world, "blocks-core.sales.transaction"),
            invoices: entityApi(world, "blocks-core.sales.invoice"),
            leads: entityApi(world, "blocks-core.sales.lead"),
            adjustments: entityApi(world, "blocks-core.sales.ledger-adjustment"),
            book: entityApi(world, "blocks-core.sales.ledger-entry"),
            settings: entityApi(world, "blocks-core.sales.ledger-settings"),
        },
        { sourceEntity, sourceId },
        CONTEXT,
    )

const entriesOf = (world: MemoryWorld): ReadonlyArray<ReadonlyArray<unknown>> =>
    rowsOf(world, "blocks-core.sales.ledger-entry").map((row) => [row.data["kind"], row.data["sourceId"], row.data["amountVnd"]])

describe("sales.book-project", () => {
    it("declares itself with the source entity and id only in its payload", () => {
        expect(bookProjectJob.name).toBe("sales.book-project")
        expect(Object.keys(bookProjectJob.input.shape)).toEqual(["sourceEntity", "sourceId"])
    })

    it("posts a matched payment as income", async () => {
        const world = worldOf()
        await run(world, "blocks-core.sales.transaction", TRANSACTION.id)
        expect(entriesOf(world)).toEqual([["income", TRANSACTION.id, 5_000_000]])
    })

    it("posts an open invoice as what is owed, and a paid invoice a credit settled the same", async () => {
        const open = worldOf()
        await run(open, "blocks-core.sales.invoice", INVOICE.id)
        expect(entriesOf(open).map((entry) => entry[0])).toEqual(["invoice"])
        const paid = worldOf()
        await run(paid, "blocks-core.sales.invoice", SETTLED)
        expect(entriesOf(paid).map((entry) => entry[0])).toEqual(["invoice"])
    })

    it("posts a paid invoice no credit settled as owed and as money in", async () => {
        const world = worldOf()
        rowsOf(world, "blocks-core.sales.transaction").splice(1)
        await run(world, "blocks-core.sales.invoice", SETTLED)
        expect(entriesOf(world).map((entry) => entry[0])).toEqual(["invoice", "income"])
    })

    it("posts the status and the counterparty the rows of the list draw", async () => {
        const world = worldOf()
        putLead(world, "00000000-0000-4000-8000-0000000000c1", "Dinh", "00000000-0000-4000-8000-0000000000c1")
        putInvoice(world, {
            ...INVOICE,
            id: "00000000-0000-4000-8000-0000000000f7",
            contactId: "00000000-0000-4000-8000-0000000000c1",
        })
        await run(world, "blocks-core.sales.transaction", TRANSACTION.id)
        await run(world, "blocks-core.sales.invoice", INVOICE.id)
        await run(world, "blocks-core.sales.invoice", "00000000-0000-4000-8000-0000000000f7")
        expect(
            rowsOf(world, "blocks-core.sales.ledger-entry").map((row) => [row.data["status"], row.data["counterparty"]]),
        ).toEqual([
            ["paid", TRANSACTION.payer],
            ["open", null],
            ["open", "Dinh"],
        ])
    })

    it("posts money out as an expense, or nothing when the workspace chose not to", async () => {
        const world = memoryWorld()
        putTransaction(world, transactionOf({ direction: "debit" }))
        await run(world, "blocks-core.sales.transaction", TRANSACTION.id)
        expect(entriesOf(world)).toEqual([["expense", TRANSACTION.id, 5_000_000]])
        const off = memoryWorld()
        putTransaction(off, transactionOf({ direction: "debit" }))
        putSettings(off, {
            postExpenses: false,
            postOutgoing: true,
            postUnmatched: false,
            voidMode: "reversal",
            vatPeriod: "quarterly",
            rematchDays: 7,
        })
        await run(off, "blocks-core.sales.transaction", TRANSACTION.id)
        expect(entriesOf(off)).toEqual([])
    })

    it("posts a correction", async () => {
        const world = worldOf()
        await run(world, "blocks-core.sales.ledger-adjustment", ADJUSTMENT.id)
        expect(entriesOf(world)).toEqual([["adjustment", ADJUSTMENT.id, 1_800_000]])
    })

    it("posts the same source once however often it runs", async () => {
        const world = worldOf()
        await run(world, "blocks-core.sales.transaction", TRANSACTION.id)
        await run(world, "blocks-core.sales.transaction", TRANSACTION.id)
        expect(rowsOf(world, "blocks-core.sales.ledger-entry")).toHaveLength(1)
    })

    it("posts nothing for a source that is gone", async () => {
        const world = worldOf()
        await run(world, "blocks-core.sales.transaction", GONE)
        await run(world, "blocks-core.sales.invoice", GONE)
        await run(world, "blocks-core.sales.ledger-adjustment", GONE)
        expect(entriesOf(world)).toEqual([])
    })
})
