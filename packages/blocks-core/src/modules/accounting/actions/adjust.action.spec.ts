import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import { INVOICE, TRANSACTION } from "../../../rules/accounting/accounting.fixtures"
import {
    ACCOUNTANT_CONTEXT,
    ACCOUNTANT_ID,
    SYSTEM_CONTEXT,
    memoryProvider,
    memoryWorld,
    putInvoice,
    putTransaction,
    rowsOf,
    withEntity,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { adjustAction } from "./adjust.action"

const NOT_RUNNABLE = new Error("not runnable")

const worldOf = (): MemoryWorld => {
    const world = memoryWorld()
    putInvoice(world, INVOICE)
    putTransaction(world, TRANSACTION)
    return world
}

const run = (world: MemoryWorld, raw: unknown, context = ACCOUNTANT_CONTEXT): Promise<ActionResult> =>
    adjustAction.execute?.(memoryProvider(world), raw, context) ?? Promise.reject(NOT_RUNNABLE)

const payload = {
    targetType: "invoice",
    targetId: INVOICE.id,
    note: "  Discount agreed  by phone",
    correctedAmount: 1_800_000,
}

describe("accounting.adjust", () => {
    it("is a transactional action of the manage permission that refreshes the books", () => {
        expect(adjustAction.id).toBe("accounting.adjust")
        expect(adjustAction.permission).toBe("accounting.manage")
        expect(adjustAction.transactional).toBe(true)
        expect(adjustAction.refreshes).toEqual([
            "accounting.entries",
            "accounting.entry-counts",
            "accounting.figures",
            "accounting.entry",
        ])
    })

    it("records the correction by the member and enqueues its book entry", async () => {
        const world = worldOf()
        const result = await run(world, payload)
        const [row] = rowsOf(world, "accounting.adjustment")
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
                job: "accounting.book-project",
                input: { sourceEntity: "accounting.adjustment", sourceId: row?.id },
                dedupeKey: `book:accounting.adjustment:${row?.id}`,
            },
        ])
    })

    it("credits the system when no member asked or the seat is gone, and takes a note without an amount", async () => {
        const system = worldOf()
        await run(
            system,
            { targetType: "transaction", targetId: TRANSACTION.id, note: "Counted twice" },
            SYSTEM_CONTEXT,
        )
        expect(rowsOf(system, "accounting.adjustment")[0]?.data).toMatchObject({
            createdBy: "system",
            createdByUser: null,
            correctedAmountVnd: null,
        })
        const gone = worldOf()
        await run(gone, payload, { ...ACCOUNTANT_CONTEXT, memberId: "00000000-0000-4000-8000-0000000000ff" })
        expect(rowsOf(gone, "accounting.adjustment")[0]?.data).toMatchObject({
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
        expect(rowsOf(world, "accounting.adjustment")).toEqual([])
    })

    it("refuses a record that is not there, and writes nothing", async () => {
        const world = memoryWorld()
        await expect(run(world, payload)).resolves.toEqual({
            ok: false,
            reason: "refused",
            message: { key: "adjust_target_missing" },
        })
        expect(rowsOf(world, "accounting.adjustment")).toEqual([])
        expect(world.jobs).toEqual([])
    })

    it("fails when the correction cannot be saved", async () => {
        const world = worldOf()
        const provider = withEntity(world, "accounting.adjustment", {
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
