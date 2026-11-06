import {
    ADJUSTMENT,
    INVOICE,
    ORDER,
    TRANSACTION,
    invoiceOf,
    transactionOf,
} from "../../../rules/accounting/accounting.fixtures"
import {
    entityApi,
    memoryWorld,
    putAdjustment,
    putInvoice,
    putRecord,
    putTransaction,
    rowsOf,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { bookProjectJob } from "./book-project.job"

const CONTEXT = { workspaceId: "w1", attempt: 1, effectKey: (step: string): string => step }
const SETTLED = "00000000-0000-4000-8000-0000000000f2"
const GONE = "7f0f0f0f-0000-4000-8000-000000000001"

type Source = "payment.transaction" | "accounting.invoice" | "accounting.adjustment"

const worldOf = (): MemoryWorld => {
    const world = memoryWorld()
    putTransaction(world, transactionOf({ status: "matched", orderId: ORDER.id }))
    putInvoice(world, INVOICE)
    putInvoice(world, invoiceOf({ id: SETTLED, status: "paid", paidAt: "2026-11-02T03:00:00.000Z" }))
    putRecord(world, "payment.transaction", "00000000-0000-4000-8000-0000000000a9", {
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
            transactions: entityApi(world, "payment.transaction"),
            invoices: entityApi(world, "accounting.invoice"),
            adjustments: entityApi(world, "accounting.adjustment"),
            book: entityApi(world, "accounting.book-entry"),
        },
        { sourceEntity, sourceId },
        CONTEXT,
    )

const entriesOf = (world: MemoryWorld): ReadonlyArray<ReadonlyArray<unknown>> =>
    rowsOf(world, "accounting.book-entry").map((row) => [row.data["kind"], row.data["sourceId"], row.data["amountVnd"]])

describe("accounting.book-project", () => {
    it("declares itself with the source entity and id only in its payload", () => {
        expect(bookProjectJob.name).toBe("accounting.book-project")
        expect(Object.keys(bookProjectJob.input.shape)).toEqual(["sourceEntity", "sourceId"])
    })

    it("posts a matched payment as income", async () => {
        const world = worldOf()
        await run(world, "payment.transaction", TRANSACTION.id)
        expect(entriesOf(world)).toEqual([["income", TRANSACTION.id, 5_000_000]])
    })

    it("posts an open invoice as what is owed, and a paid invoice a credit settled the same", async () => {
        const open = worldOf()
        await run(open, "accounting.invoice", INVOICE.id)
        expect(entriesOf(open).map((entry) => entry[0])).toEqual(["invoice"])
        const paid = worldOf()
        await run(paid, "accounting.invoice", SETTLED)
        expect(entriesOf(paid).map((entry) => entry[0])).toEqual(["invoice"])
    })

    it("posts a paid invoice no credit settled as owed and as money in", async () => {
        const world = worldOf()
        rowsOf(world, "payment.transaction").splice(1)
        await run(world, "accounting.invoice", SETTLED)
        expect(entriesOf(world).map((entry) => entry[0])).toEqual(["invoice", "income"])
    })

    it("posts a correction", async () => {
        const world = worldOf()
        await run(world, "accounting.adjustment", ADJUSTMENT.id)
        expect(entriesOf(world)).toEqual([["adjustment", ADJUSTMENT.id, 1_800_000]])
    })

    it("posts the same source once however often it runs", async () => {
        const world = worldOf()
        await run(world, "payment.transaction", TRANSACTION.id)
        await run(world, "payment.transaction", TRANSACTION.id)
        expect(rowsOf(world, "accounting.book-entry")).toHaveLength(1)
    })

    it("posts nothing for a source that is gone", async () => {
        const world = worldOf()
        await run(world, "payment.transaction", GONE)
        await run(world, "accounting.invoice", GONE)
        await run(world, "accounting.adjustment", GONE)
        expect(entriesOf(world)).toEqual([])
    })
})
