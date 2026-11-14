import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import { ORDER, TRANSACTION, orderOf, transactionOf } from "../rules/accounting.fixtures"
import type { OrderRecord, TransactionRecord } from "../rules/accounting.types"
import {
    SYSTEM_CONTEXT,
    memoryProvider,
    memoryWorld,
    putOrder,
    putTransaction,
    rowsOf,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { repostLedgerAction } from "./repost-ledger.action"

const PAID = transactionOf({ status: "matched", orderId: ORDER.id })
const PAID_ORDER = orderOf({ status: "paid" })

const worldOf = (transaction: TransactionRecord | null = PAID, order: OrderRecord | null = PAID_ORDER): MemoryWorld => {
    const world = memoryWorld()
    if (transaction !== null) putTransaction(world, transaction)
    if (order !== null) putOrder(world, order)
    return world
}

const run = (world: MemoryWorld, raw: unknown, now = new Date("2026-11-07T10:00:30Z")): Promise<ActionResult> =>
    repostLedgerAction.execute?.(memoryProvider(world), raw, { ...SYSTEM_CONTEXT, now }) ??
    Promise.reject(new Error("not runnable"))

describe("sales.repost-ledger", () => {
    it("is a transactional action of the accounting permission that refreshes nothing", () => {
        expect(repostLedgerAction.id).toBe("sales.repost-ledger")
        expect(repostLedgerAction.permission).toBe("sales.manage")
        expect(repostLedgerAction.transactional).toBe(true)
        expect(repostLedgerAction.refreshes).toEqual([])
    })

    it("enqueues a new ledger append job for the payment and its paid order, and writes nothing else", async () => {
        const world = worldOf()
        await expect(run(world, { id: PAID.id })).resolves.toEqual({
            ok: true,
            data: { result: "queued", transactionId: PAID.id },
        })
        expect(world.jobs).toEqual([
            {
                job: "sales.ledger-append",
                input: { transactionId: PAID.id, orderId: ORDER.id },
                dedupeKey: `ledger-repost:${PAID.id}:2026-11-07T10:00`,
            },
        ])
        expect(rowsOf(world, "blocks-core.sales.transaction")[0]?.data).toMatchObject({ status: "matched" })
        expect(world.calls).toEqual([])
    })

    it("keys the job by the minute, so a press in the same minute is the same job and a later one is a new job", async () => {
        const first = worldOf()
        const second = worldOf()
        await run(first, { id: PAID.id }, new Date("2026-11-07T10:00:05Z"))
        await run(second, { id: PAID.id }, new Date("2026-11-07T10:00:55Z"))
        await run(second, { id: PAID.id }, new Date("2026-11-07T10:03:00Z"))
        expect(first.jobs[0]?.dedupeKey).toBe(second.jobs[0]?.dedupeKey)
        expect(second.jobs.map((job) => job.dedupeKey)).toEqual([
            `ledger-repost:${PAID.id}:2026-11-07T10:00`,
            `ledger-repost:${PAID.id}:2026-11-07T10:03`,
        ])
    })

    it("refuses a payment that is gone, paid no order, or whose order is gone or not paid, and enqueues nothing", async () => {
        const cases: ReadonlyArray<readonly [MemoryWorld, string]> = [
            [worldOf(null), "transaction_missing"],
            [worldOf(TRANSACTION), "transaction_not_paid"],
            [worldOf(PAID, null), "order_missing"],
            [worldOf(PAID, orderOf({ status: "confirmed" })), "order_not_paid"],
        ]
        for (const [world, reason] of cases) {
            await expect(run(world, { id: TRANSACTION.id })).resolves.toMatchObject({
                ok: false,
                reason: "refused",
                data: { reason },
            })
            expect(world.jobs).toEqual([])
        }
    })

    it("refuses an input that is not a payment id", async () => {
        await expect(run(worldOf(), { id: "x" })).resolves.toMatchObject({ ok: false, reason: "invalid" })
    })
})
