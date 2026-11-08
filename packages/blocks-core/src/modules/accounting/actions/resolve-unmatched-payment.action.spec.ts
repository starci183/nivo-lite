import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import { BlocksError } from "../../../blocks-error"
import { ORDER, TRANSACTION, orderOf, transactionOf } from "../../../rules/accounting/accounting.fixtures"
import type { TransactionRecord } from "../../../rules/accounting/accounting.types"
import {
    SYSTEM_CONTEXT,
    memoryProvider,
    memoryWorld,
    putOrder,
    putTransaction,
    rowsOf,
    withEntity,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { resolveUnmatchedPaymentAction } from "./resolve-unmatched-payment.action"

const COMMAND = "accounting.resolve-unmatched-payment"
const OTHER = { id: TRANSACTION.id, command: COMMAND, kind: "other-income" }
const ASSIGN = { id: TRANSACTION.id, command: COMMAND, order: ORDER.id }

const worldOf = (transaction: TransactionRecord | null = TRANSACTION): MemoryWorld => {
    const world = memoryWorld()
    if (transaction !== null) putTransaction(world, transaction)
    putOrder(world, ORDER)
    return world
}

const run = (world: MemoryWorld, raw: unknown): Promise<ActionResult> =>
    resolveUnmatchedPaymentAction.execute?.(memoryProvider(world), raw, SYSTEM_CONTEXT) ??
    Promise.reject(new BlocksError("ACTION_NOT_RUNNABLE", "execute"))

describe("accounting.resolve-unmatched-payment", () => {
    it("is a transactional action of the accounting permission, run from the approval row of a payment", () => {
        expect(resolveUnmatchedPaymentAction.id).toBe("accounting.resolve-unmatched-payment")
        expect(resolveUnmatchedPaymentAction.permission).toBe("accounting.manage")
        expect(resolveUnmatchedPaymentAction.transactional).toBe(true)
        expect(resolveUnmatchedPaymentAction.refreshes).toContain("accounting.decisions")
    })

    it("ties the payment to the order through the normal payment path", async () => {
        const world = worldOf()
        await expect(run(world, ASSIGN)).resolves.toEqual({ ok: true, data: { result: "paid", orderId: ORDER.id } })
        expect(rowsOf(world, "payment.transaction")[0]?.data).toMatchObject({ status: "matched", orderId: ORDER.id })
        expect(rowsOf(world, "sales.order")[0]?.data).toMatchObject({ status: "paid" })
        expect(world.jobs.map((job) => job.job)).toEqual([
            "accounting.ledger-append",
            "accounting.book-project",
            "payment.confirm-notice",
        ])
    })

    it("refuses an order that does not take the payment, as data", async () => {
        const world = memoryWorld()
        putTransaction(world, TRANSACTION)
        putOrder(world, orderOf({ amountVnd: 4_000_000 }))
        await expect(run(world, ASSIGN)).resolves.toMatchObject({
            ok: false,
            reason: "refused",
            data: { reason: "amount_differs" },
        })
    })

    it("records the payment as other income and projects its book entry, writing records only", async () => {
        const world = worldOf()
        await expect(run(world, OTHER)).resolves.toEqual({
            ok: true,
            data: { result: "other-income", transactionId: TRANSACTION.id },
        })
        expect(rowsOf(world, "payment.transaction")[0]?.data).toMatchObject({ status: "other_income", orderId: null })
        expect(world.jobs).toEqual([
            {
                job: "accounting.book-project",
                input: { sourceEntity: "payment.transaction", sourceId: TRANSACTION.id },
                dedupeKey: `book:payment.transaction:${TRANSACTION.id}`,
            },
        ])
        expect(world.calls).toEqual([])
    })

    it("refuses a payment that is gone, money out or already resolved, and writes nothing", async () => {
        const cases: ReadonlyArray<readonly [TransactionRecord | null, string]> = [
            [null, "transaction_missing"],
            [transactionOf({ direction: "debit" }), "transaction_not_credit"],
            [transactionOf({ status: "other_income" }), "transaction_not_open"],
        ]
        for (const [transaction, reason] of cases) {
            const world = worldOf(transaction)
            await expect(run(world, OTHER)).resolves.toMatchObject({ ok: false, reason: "refused", data: { reason } })
            expect(world.jobs).toEqual([])
        }
    })

    it("answers conflict when another writer changed the payment first", async () => {
        const world = worldOf()
        const result = await resolveUnmatchedPaymentAction.execute?.(
            withEntity(world, "payment.transaction", {
                update: () => Promise.resolve({ ok: false, reason: "stale" }),
            }),
            OTHER,
            SYSTEM_CONTEXT,
        )
        expect(result).toMatchObject({ ok: false, reason: "conflict" })
        expect(world.jobs).toEqual([])
    })

    it("refuses an input that names neither an order nor other income, or both", async () => {
        const world = worldOf()
        const base = { id: TRANSACTION.id, command: COMMAND }
        for (const chosen of [{}, { kind: "gift" }, { order: "x" }, { order: ORDER.id, kind: "other-income" }])
            await expect(run(world, { ...base, ...chosen })).resolves.toMatchObject({ ok: false, reason: "invalid" })
    })

    it("refuses the choice nested under `values`: the door receives the choice flat, beside the id", async () => {
        await expect(
            run(worldOf(), { id: TRANSACTION.id, command: COMMAND, values: { order: ORDER.id } }),
        ).resolves.toMatchObject({ ok: false, reason: "invalid" })
    })
})
