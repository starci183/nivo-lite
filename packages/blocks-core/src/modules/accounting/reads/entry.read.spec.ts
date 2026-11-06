import type { ReadRunResult } from "@nivo-lite/agent-sdk/block"
import { ADJUSTMENT, INVOICE, ORDER, TRANSACTION, transactionOf } from "../../../rules/accounting/accounting.fixtures"
import type { BookEntryRecord, TransactionRecord } from "../../../rules/accounting/accounting.types"
import {
    ACCOUNTANT_CONTEXT,
    memoryProvider,
    memoryWorld,
    putAdjustment,
    putBookEntry,
    putInvoice,
    putOrder,
    putTransaction,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { entryRead } from "./entry.read"

const ENTRY_ID = "00000000-0000-4000-8000-0000000000e9"

const matched = transactionOf({ status: "matched", orderId: ORDER.id })

const entryOf = (changes: Partial<BookEntryRecord>): BookEntryRecord => ({
    id: ENTRY_ID,
    version: "1",
    kind: "income",
    sourceEntity: "payment.transaction",
    sourceId: TRANSACTION.id,
    entryDate: "2026-11-04",
    amountVnd: 5_000_000,
    note: "NGUYEN VAN DINH",
    counterparty: null,
    status: "paid",
    ...changes,
})

const worldOf = (entry: BookEntryRecord | null, transaction: TransactionRecord | null = matched): MemoryWorld => {
    const world = memoryWorld()
    if (entry !== null) putBookEntry(world, entry)
    if (transaction !== null) putTransaction(world, transaction)
    putOrder(world, ORDER)
    putInvoice(world, INVOICE)
    putAdjustment(world, ADJUSTMENT)
    return world
}

const read = (world: MemoryWorld, raw: unknown = { id: ENTRY_ID }): Promise<ReadRunResult> =>
    entryRead.execute?.(memoryProvider(world), raw, ACCOUNTANT_CONTEXT) ?? Promise.resolve({ ok: false, problems: [] })

describe("accounting.entry", () => {
    it("draws a payment entry with the order it paid", async () => {
        const result = await read(worldOf(entryOf({})))
        expect(result).toMatchObject({
            ok: true,
            data: { id: ENTRY_ID, kind: "income", amountVnd: 5_000_000, adjustmentCount: 0 },
        })
        const steps = result.ok ? JSON.stringify(result.data) : ""
        expect(steps).toContain("DH-20261104-0001")
        expect(steps).toContain("NGUYEN VAN DINH")
    })

    it("draws a payment that paid no order without one", async () => {
        const result = await read(worldOf(entryOf({}), transactionOf({ status: "matched" })))
        expect(result.ok && JSON.stringify(result.data)).not.toContain("DH-20261104-0001")
    })

    it("draws an invoice entry with the corrections that point at it", async () => {
        const result = await read(
            worldOf(entryOf({ kind: "invoice", sourceEntity: "accounting.invoice", sourceId: INVOICE.id })),
        )
        expect(result).toMatchObject({ ok: true, data: { kind: "invoice", adjustmentCount: 1 } })
    })

    it("draws a correction entry with the correction", async () => {
        const result = await read(
            worldOf(entryOf({ kind: "adjustment", sourceEntity: "accounting.adjustment", sourceId: ADJUSTMENT.id })),
        )
        expect(result).toMatchObject({ ok: true, data: { kind: "adjustment", adjustmentCount: 1 } })
    })

    it("draws an entry of an unknown source with no lineage", async () => {
        const result = await read(worldOf(entryOf({ sourceEntity: "payment.other" })))
        expect(result).toMatchObject({ ok: true, data: { lineage: [], adjustmentCount: 0 } })
    })

    it("draws a payment that is gone with no lineage", async () => {
        const result = await read(worldOf(entryOf({}), null))
        expect(result).toMatchObject({ ok: true, data: { lineage: [] } })
    })

    it("yields null for an entry that is gone and refuses a missing id", async () => {
        await expect(read(worldOf(null))).resolves.toEqual({ ok: true, data: null })
        await expect(read(worldOf(null), {})).resolves.toMatchObject({ ok: false })
    })
})
