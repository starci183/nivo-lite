import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import { ADJUSTMENT, INVOICE, TRANSACTION } from "../rules/accounting.fixtures"
import { entryStatusOf } from "../rules/entry-status"
import {
    ACCOUNTANT_CONTEXT,
    ACCOUNTANT_ID,
    SYSTEM_CONTEXT,
    memoryProvider,
    memoryWorld,
    putBookEntry,
    putInvoice,
    putTransaction,
    rowsOf,
    withEntity,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { adjustAction } from "./adjust.action"

const NOT_RUNNABLE = new Error("not runnable")

const INVOICE_ENTRY = "00000000-0000-4000-8000-0000000001a3"
const PAYMENT_ENTRY = "00000000-0000-4000-8000-0000000001a1"
const CORRECTION_ENTRY = "00000000-0000-4000-8000-0000000001a2"

const entryOf = (id: string, kind: "income" | "invoice" | "adjustment", sourceEntity: string, sourceId: string) => ({
    id,
    version: "1",
    kind,
    sourceEntity,
    sourceId,
    entryDate: "2026-11-02",
    amountVnd: 1,
    note: null,
    counterparty: null,
    status: entryStatusOf(kind),
})

const worldOf = (): MemoryWorld => {
    const world = memoryWorld()
    putInvoice(world, INVOICE)
    putTransaction(world, TRANSACTION)
    putBookEntry(world, entryOf(INVOICE_ENTRY, "invoice", "blocks-core.sales.invoice", INVOICE.id))
    putBookEntry(world, entryOf(PAYMENT_ENTRY, "income", "blocks-core.sales.transaction", TRANSACTION.id))
    putBookEntry(world, entryOf(CORRECTION_ENTRY, "adjustment", "blocks-core.sales.ledger-adjustment", ADJUSTMENT.id))
    return world
}

const run = (world: MemoryWorld, raw: unknown, context = ACCOUNTANT_CONTEXT): Promise<ActionResult> =>
    adjustAction.execute?.(memoryProvider(world), raw, context) ?? Promise.reject(NOT_RUNNABLE)

const payload = {
    id: INVOICE_ENTRY,
    note: "  Discount agreed  by phone",
    correctedAmount: 1_800_000,
}

describe("sales.adjust", () => {
    it("is a transactional action of the manage permission that refreshes the books", () => {
        expect(adjustAction.id).toBe("sales.adjust")
        expect(adjustAction.permission).toBe("sales.manage")
        expect(adjustAction.transactional).toBe(true)
        expect(adjustAction.refreshes).toEqual([
            "blocks-core.sales.api.entry.list",
            "blocks-core.sales.api.entry.counts",
            "blocks-core.sales.api.entry.status-counts",
            "blocks-core.sales.api.entry.weekly",
            "blocks-core.sales.api.entry.ledger",
            "blocks-core.sales.api.transaction.decisions",
            "blocks-core.sales.api.entry.figures",
            "blocks-core.sales.api.entry.get",
        ])
    })

    it("records the correction by the member and enqueues its book entry", async () => {
        const world = worldOf()
        const result = await run(world, payload)
        const [row] = rowsOf(world, "blocks-core.sales.ledger-adjustment")
        expect(result).toEqual({ ok: true, data: { id: row?.id } })
        expect(row?.data).toEqual({
            targetType: "invoice",
            targetId: INVOICE.id,
            note: "Discount agreed by phone",
            correctedAmountVnd: 1_800_000,
            createdBy: "Lan",
            createdByUser: ACCOUNTANT_ID,
        })
        expect(world.jobs).toEqual([
            {
                job: "sales.book-project",
                input: { sourceEntity: "blocks-core.sales.ledger-adjustment", sourceId: row?.id },
                dedupeKey: `book:blocks-core.sales.ledger-adjustment:${row?.id}`,
            },
        ])
    })

    it("credits the system when no member asked or the seat is gone, and takes a note without an amount", async () => {
        const system = worldOf()
        await run(system, { id: PAYMENT_ENTRY, note: "Counted twice" }, SYSTEM_CONTEXT)
        expect(rowsOf(system, "blocks-core.sales.ledger-adjustment")[0]?.data).toMatchObject({
            createdBy: "system",
            createdByUser: null,
            correctedAmountVnd: null,
        })
        const gone = worldOf()
        await run(gone, payload, { ...ACCOUNTANT_CONTEXT, memberId: "00000000-0000-4000-8000-0000000000ff" })
        expect(rowsOf(gone, "blocks-core.sales.ledger-adjustment")[0]?.data).toMatchObject({
            createdBy: "system",
            createdByUser: null,
        })
    })

    it("refuses a short note and a bad amount, naming the field", async () => {
        const world = worldOf()
        await expect(run(world, { ...payload, note: "ok" })).resolves.toEqual({
            ok: false,
            reason: "invalid",
            message: { key: "adjust_note_length" },
            fields: { note: { key: "adjust_note_length" } },
        })
        await expect(run(world, { ...payload, correctedAmount: -5 })).resolves.toEqual({
            ok: false,
            reason: "invalid",
            message: { key: "adjust_amount_invalid" },
            fields: { correctedAmount: { key: "adjust_amount_invalid" } },
        })
        expect(rowsOf(world, "blocks-core.sales.ledger-adjustment")).toEqual([])
    })

    it("refuses an entry that is gone and an entry that is itself a correction, and writes nothing", async () => {
        const gone = memoryWorld()
        await expect(run(gone, payload)).resolves.toEqual({
            ok: false,
            reason: "refused",
            message: { key: "adjust_target_missing" },
        })
        const world = worldOf()
        await expect(run(world, { ...payload, id: CORRECTION_ENTRY })).resolves.toEqual({
            ok: false,
            reason: "refused",
            message: { key: "adjust_entry_final" },
        })
        expect(rowsOf(world, "blocks-core.sales.ledger-adjustment")).toEqual([])
        expect(world.jobs).toEqual([])
    })

    it("refuses an entry whose source record is not there, and writes nothing", async () => {
        const world = memoryWorld()
        putBookEntry(world, entryOf(INVOICE_ENTRY, "invoice", "blocks-core.sales.invoice", INVOICE.id))
        await expect(run(world, payload)).resolves.toEqual({
            ok: false,
            reason: "refused",
            message: { key: "adjust_target_missing" },
        })
        expect(rowsOf(world, "blocks-core.sales.ledger-adjustment")).toEqual([])
        expect(world.jobs).toEqual([])
    })

    it("fails when the correction cannot be saved", async () => {
        const world = worldOf()
        const provider = withEntity(world, "blocks-core.sales.ledger-adjustment", {
            insert: () => Promise.resolve({ ok: false, reason: "invalid" }),
        })
        await expect(adjustAction.execute?.(provider, payload, ACCOUNTANT_CONTEXT)).resolves.toEqual({
            ok: false,
            reason: "failed",
            message: { key: "adjust_failed" },
        })
        expect(world.jobs).toEqual([])
    })

    it("answers invalid for a payload the door should never have passed", async () => {
        const world = worldOf()
        await expect(run(world, { ...payload, targetType: "order" })).resolves.toMatchObject({
            ok: false,
            reason: "invalid",
        })
    })
})
