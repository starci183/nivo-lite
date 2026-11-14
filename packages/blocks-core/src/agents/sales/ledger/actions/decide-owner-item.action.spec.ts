import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import { ORDER, TRANSACTION } from "../rules/accounting.fixtures"
import {
    SYSTEM_CONTEXT,
    memoryProvider,
    memoryWorld,
    putOrder,
    putQuestion,
    putTransaction,
    rowsOf,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { decideOwnerItemAction } from "./decide-owner-item.action"

const COMMAND = "sales.resolve-unmatched-payment"
const QUESTION = "00000000-0000-4000-8000-0000000003a1"

const worldOf = (): MemoryWorld => {
    const world = memoryWorld()
    putTransaction(world, TRANSACTION)
    putOrder(world, ORDER)
    putQuestion(world, QUESTION, { text: "How much?", source: null }, "2026-11-04T01:00:00.000Z")
    return world
}

const run = (world: MemoryWorld, raw: unknown): Promise<ActionResult> =>
    decideOwnerItemAction.execute?.(memoryProvider(world), raw, SYSTEM_CONTEXT) ??
    Promise.reject(new Error("not runnable"))

describe("sales.decide-owner-item", () => {
    it("is the transactional action of the queue, refreshing it and the figures of today", () => {
        expect(decideOwnerItemAction.permission).toBe("sales.manage")
        expect(decideOwnerItemAction.transactional).toBe(true)
        expect(decideOwnerItemAction.refreshes).toEqual(
            expect.arrayContaining(["blocks-core.sales.api.question.owner-queue", "blocks-core.sales.api.entry.today"]),
        )
    })

    it("ties a payment to an order", async () => {
        const world = worldOf()
        await expect(run(world, { id: TRANSACTION.id, command: COMMAND, order: ORDER.id })).resolves.toMatchObject({
            ok: true,
        })
        expect(rowsOf(world, "blocks-core.sales.transaction")[0]?.data).toMatchObject({ status: "matched" })
    })

    it("records a payment as other income", async () => {
        const world = worldOf()
        await expect(run(world, { id: TRANSACTION.id, command: COMMAND, kind: "other-income" })).resolves.toMatchObject(
            { ok: true, data: { result: "other-income" } },
        )
    })

    it("refuses a payment command with both or neither of an order and a kind, or an id that is no uuid", async () => {
        const world = worldOf()
        const both = { id: TRANSACTION.id, command: COMMAND, order: ORDER.id, kind: "other-income" }
        await expect(run(world, both)).resolves.toMatchObject({ ok: false, reason: "invalid" })
        await expect(run(world, { id: TRANSACTION.id, command: COMMAND })).resolves.toMatchObject({
            ok: false,
            reason: "invalid",
        })
        await expect(run(world, { id: "x", command: COMMAND, kind: "other-income" })).resolves.toMatchObject({
            ok: false,
            reason: "invalid",
        })
    })

    it("answers a question", async () => {
        const world = worldOf()
        await expect(run(world, { id: QUESTION, command: "edit", answer: "450000" })).resolves.toEqual({ ok: true })
        expect(rowsOf(world, "blocks-core.sales.ledger-question")[0]?.data).toMatchObject({ status: "answered" })
    })

    it("refuses an answer that is missing or empty", async () => {
        const world = worldOf()
        await expect(run(world, { id: QUESTION, command: "edit" })).resolves.toMatchObject({
            ok: false,
            reason: "invalid",
        })
        await expect(run(world, { id: QUESTION, command: "edit", answer: "  " })).resolves.toMatchObject({
            ok: false,
            fields: { answer: { key: "answer_empty" } },
        })
    })
})
