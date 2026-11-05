import type { ReadRunResult } from "@nivo-lite/agent-sdk/block"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { ADJUSTMENT, INVOICE, ORDER, TRANSACTION, transactionOf } from "../../../rules/accounting/accounting.fixtures"
import type { BookEntryRecord } from "../../../rules/accounting/accounting.types"
import {
    adjustmentStore,
    bookEntryStore,
    invoiceStore,
    orderStore,
    providerOf,
    transactionStore,
} from "../accounting.doubles"
import { adjustmentsPort, bookEntriesPort, invoicesPort, ordersPort, transactionsPort } from "../ports"
import { entryRead } from "./entry.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T12:00:00.000Z") }
const NOT_RUNNABLE: ReadRunResult = { ok: false, problems: [] }

const matched = transactionOf({ status: "matched", orderId: ORDER.id })

const entryOf = (changes: Partial<BookEntryRecord>): BookEntryRecord => ({
    id: "e1",
    version: "1",
    kind: "income",
    sourceEntity: "payment.transaction",
    sourceId: TRANSACTION.id,
    entryDate: "2026-11-04",
    amountVnd: 5_000_000,
    note: "NGUYEN VAN DINH",
    ...changes,
})

const read = (entry: BookEntryRecord | null, transaction = matched): Promise<ReadRunResult> => {
    const provider = providerOf([
        [bookEntriesPort, bookEntryStore({ get: () => Promise.resolve(entry) })],
        [transactionsPort, transactionStore({ get: () => Promise.resolve(transaction) })],
        [ordersPort, orderStore({ get: () => Promise.resolve(ORDER) })],
        [invoicesPort, invoiceStore({ get: () => Promise.resolve(INVOICE) })],
        [
            adjustmentsPort,
            adjustmentStore({
                get: () => Promise.resolve(ADJUSTMENT),
                of: (type) => Promise.resolve(type === "invoice" ? [ADJUSTMENT] : []),
            }),
        ],
    ])
    return entryRead.execute?.(provider, { id: "e1" }, CONTEXT) ?? Promise.resolve(NOT_RUNNABLE)
}

describe("accounting.entry", () => {
    it("draws a payment's entry with the order it paid", async () => {
        const result = await read(entryOf({}))
        expect(result).toMatchObject({
            ok: true,
            data: { id: "e1", kind: "income", amountVnd: 5_000_000, adjustmentCount: 0 },
        })
        const steps = result.ok ? JSON.stringify(result.data) : ""
        expect(steps).toContain("DH-20261104-0001")
        expect(steps).toContain("NGUYEN VAN DINH")
    })

    it("draws a payment that paid no order without one", async () => {
        const result = await read(entryOf({}), transactionOf({ status: "matched" }))
        expect(result.ok && JSON.stringify(result.data)).not.toContain("DH-20261104-0001")
    })

    it("draws an invoice's entry with the corrections that point at it", async () => {
        const result = await read(
            entryOf({ kind: "invoice", sourceEntity: "accounting.invoice", sourceId: INVOICE.id }),
        )
        expect(result).toMatchObject({ ok: true, data: { kind: "invoice", adjustmentCount: 1 } })
    })

    it("draws a correction's entry with the correction", async () => {
        const result = await read(
            entryOf({ kind: "adjustment", sourceEntity: "accounting.adjustment", sourceId: ADJUSTMENT.id }),
        )
        expect(result).toMatchObject({ ok: true, data: { kind: "adjustment", adjustmentCount: 1 } })
    })

    it("draws an entry of an unknown source with no lineage", async () => {
        const result = await read(entryOf({ sourceEntity: "payment.other" }))
        expect(result).toMatchObject({ ok: true, data: { lineage: [], adjustmentCount: 0 } })
    })

    it("draws a payment that is gone with no lineage", async () => {
        const provider = providerOf([
            [bookEntriesPort, bookEntryStore({ get: () => Promise.resolve(entryOf({})) })],
            [transactionsPort, transactionStore({ get: () => Promise.resolve(null) })],
            [ordersPort, orderStore()],
            [invoicesPort, invoiceStore()],
            [adjustmentsPort, adjustmentStore({ of: () => Promise.resolve([]) })],
        ])
        await expect(entryRead.execute?.(provider, { id: "e1" }, CONTEXT)).resolves.toMatchObject({
            ok: true,
            data: { lineage: [] },
        })
    })

    it("yields null for an entry that is gone and refuses a missing id", async () => {
        await expect(read(null)).resolves.toEqual({ ok: true, data: null })
        const provider = providerOf([])
        await expect(entryRead.execute?.(provider, {}, CONTEXT)).resolves.toMatchObject({ ok: false })
    })
})
