import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import {
    CLAIM,
    ORDER,
    TRANSACTION,
    claimOf,
    orderOf,
    transactionOf,
} from "../../../rules/accounting/accounting.fixtures"
import type { ClaimRecord, OrderRecord, TransactionRecord } from "../../../rules/accounting/accounting.types"
import { claimStore, orderStore, providerOf, recordingOutbox, transactionStore } from "../accounting.doubles"
import type { WriteResult } from "../accounting.types"
import { claimsPort, ordersPort, outboxPort, transactionsPort } from "../ports"
import { settleAction } from "./settle.action"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: null, now: new Date("2026-11-04T12:00:00.000Z") }

const NOT_RUNNABLE: ActionResult = { ok: false, reason: "failed", message: { key: "not_runnable" } }

interface Setup {
    readonly transaction?: TransactionRecord | null
    readonly order?: OrderRecord | null
    readonly claim?: ClaimRecord | null
    readonly settleTransaction?: WriteResult<TransactionRecord>
    readonly setStatus?: WriteResult<OrderRecord>
    readonly settleClaim?: WriteResult<ClaimRecord>
}

const harness = (setup: Setup = {}) => {
    const writes: Array<string> = []
    const { outbox, jobs } = recordingOutbox()
    const transaction = setup.transaction === undefined ? TRANSACTION : setup.transaction
    const order = setup.order === undefined ? ORDER : setup.order
    const claim = setup.claim === undefined ? CLAIM : setup.claim
    const provider = providerOf([
        [
            transactionsPort,
            transactionStore({
                get: () => Promise.resolve(transaction),
                settle: (id, expected, orderId) => {
                    writes.push(`transaction:${id}:${expected}:${orderId}`)
                    return Promise.resolve(setup.settleTransaction ?? { ok: true, row: TRANSACTION })
                },
            }),
        ],
        [
            ordersPort,
            orderStore({
                get: () => Promise.resolve(order),
                setStatus: (id, expected, status) => {
                    writes.push(`order:${id}:${expected}:${status}`)
                    return Promise.resolve(setup.setStatus ?? { ok: true, row: ORDER })
                },
            }),
        ],
        [
            claimsPort,
            claimStore({
                get: () => Promise.resolve(claim),
                settle: (id, expected, transactionId) => {
                    writes.push(`claim:${id}:${expected}:${transactionId}`)
                    return Promise.resolve(setup.settleClaim ?? { ok: true, row: CLAIM })
                },
            }),
        ],
        [outboxPort, outbox],
    ])
    const run = (raw: unknown): Promise<ActionResult> => {
        return settleAction.execute?.(provider, raw, CONTEXT) ?? Promise.resolve(NOT_RUNNABLE)
    }
    return { writes, jobs, run }
}

const payload = { transactionId: TRANSACTION.id, orderId: ORDER.id }

describe("payment.settle", () => {
    it("is a transactional action of the payment permission that the graph runs", () => {
        expect(settleAction.id).toBe("payment.settle")
        expect(settleAction.permission).toBe("payment.manage")
        expect(settleAction.transactional).toBe(true)
        expect(settleAction.refreshes).toEqual([])
    })

    it("ties the transaction to the order, pays it and enqueues the ledger line, the book entry and the notice", async () => {
        const { writes, jobs, run } = harness()
        await expect(run(payload)).resolves.toEqual({ ok: true, data: { result: "paid", orderId: ORDER.id } })
        expect(writes).toEqual([`transaction:${TRANSACTION.id}:3:${ORDER.id}`, `order:${ORDER.id}:2:paid`])
        expect(jobs).toEqual([
            {
                name: "accounting.ledger-append",
                input: { transactionId: TRANSACTION.id, orderId: ORDER.id },
                options: { dedupeKey: `ledger:${TRANSACTION.id}` },
            },
            {
                name: "accounting.book-project",
                input: { sourceEntity: "payment.transaction", sourceId: TRANSACTION.id },
                options: { dedupeKey: `book:payment.transaction:${TRANSACTION.id}` },
            },
            {
                name: "payment.confirm-notice",
                input: { orderId: ORDER.id },
                options: { dedupeKey: `notice:${ORDER.id}` },
            },
        ])
    })

    it("settles the claim that started it", async () => {
        const { writes, run } = harness()
        await expect(run({ ...payload, claimId: CLAIM.id })).resolves.toMatchObject({ ok: true })
        expect(writes).toContain(`claim:${CLAIM.id}:1:${TRANSACTION.id}`)
    })

    it("leaves a claim this very transaction already settled as it is", async () => {
        const settled = claimOf({ status: "settled", settledTransactionId: TRANSACTION.id })
        const { writes, run } = harness({ claim: settled })
        await expect(run({ ...payload, claimId: CLAIM.id })).resolves.toMatchObject({ ok: true })
        expect(writes.some((write) => write.startsWith("claim:"))).toBe(false)
    })

    it("changes nothing when the transaction already paid the order", async () => {
        const paid = transactionOf({ status: "matched", orderId: ORDER.id })
        const { writes, jobs, run } = harness({ transaction: paid })
        await expect(run({ ...payload, claimId: null })).resolves.toEqual({
            ok: true,
            data: { result: "already-paid", orderId: ORDER.id },
        })
        expect(writes).toEqual([])
        expect(jobs).toEqual([])
    })

    it("refuses what is not clean as data, naming the reason, and writes nothing", async () => {
        const cases: ReadonlyArray<readonly [Setup, string, string]> = [
            [{ transaction: null }, "transaction_missing", "settle_transaction_missing"],
            [{ order: null }, "order_missing", "settle_order_missing"],
            [{ order: orderOf({ status: "paid" }) }, "order_not_open", "settle_order_not_open"],
            [{ order: orderOf({ amountVnd: 4_000_000 }) }, "amount_differs", "settle_amount_differs"],
            [{ transaction: transactionOf({ orderId: "other" }) }, "transaction_used", "settle_transaction_used"],
        ]
        for (const [setup, reason, key] of cases) {
            const { writes, jobs, run } = harness(setup)
            await expect(run(payload)).resolves.toEqual({
                ok: false,
                reason: "refused",
                message: { key },
                data: { reason },
            })
            expect(writes).toEqual([])
            expect(jobs).toEqual([])
        }
    })

    it("refuses a claim that is named but gone", async () => {
        const { run } = harness({ claim: null })
        await expect(run({ ...payload, claimId: CLAIM.id })).resolves.toMatchObject({
            ok: false,
            data: { reason: "claim_missing" },
        })
    })

    it("answers a conflict when another writer got there first, at any of the three writes", async () => {
        const stale: WriteResult<never> = { ok: false, reason: "stale" }
        const expected = { ok: false, reason: "conflict", message: { key: "settle_stale" } }
        await expect(harness({ settleTransaction: stale }).run(payload)).resolves.toEqual(expected)
        await expect(harness({ setStatus: stale }).run(payload)).resolves.toEqual(expected)
        await expect(harness({ settleClaim: stale }).run({ ...payload, claimId: CLAIM.id })).resolves.toEqual(expected)
    })

    it("refuses when the database refuses a second link of the transaction", async () => {
        const taken: WriteResult<never> = { ok: false, reason: "taken" }
        await expect(harness({ settleTransaction: taken }).run(payload)).resolves.toMatchObject({
            ok: false,
            reason: "refused",
            data: { reason: "transaction_used" },
        })
    })

    it("answers invalid for a payload the door should never have passed", async () => {
        const { run } = harness()
        await expect(run({ ...payload, transactionId: "not-a-uuid" })).resolves.toMatchObject({
            ok: false,
            reason: "invalid",
        })
        await expect(run({ ...payload, extra: 1 })).resolves.toMatchObject({ ok: false, reason: "invalid" })
    })
})
