import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EngineResult, EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import {
    CLAIM,
    ORDER,
    TRANSACTION,
    claimOf,
    orderOf,
    transactionOf,
} from "../rules/accounting.fixtures"
import type { OrderRecord, TransactionRecord } from "../rules/accounting.types"
import {
    SYSTEM_CONTEXT,
    entityApi,
    memoryProvider,
    outbox,
    memoryWorld,
    putClaim,
    putOrder,
    putTransaction,
    rowsOf,
    withEntity,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { settleAction, settleOnOrder } from "./settle.action"
import type { SettlePorts } from "./settle.action"

const payload = { transactionId: TRANSACTION.id, orderId: ORDER.id }

interface Setup {
    readonly transaction?: TransactionRecord | null
    readonly order?: OrderRecord | null
}

/** A world with Dinh's payment, order and claim, as the fixtures have them; a setup replaces or drops the payment or the order. */
const worldOf = (setup: Setup = {}): MemoryWorld => {
    const world = memoryWorld()
    const transaction = setup.transaction === undefined ? TRANSACTION : setup.transaction
    const order = setup.order === undefined ? ORDER : setup.order
    if (transaction !== null) putTransaction(world, transaction)
    if (order !== null) putOrder(world, order)
    putClaim(world, CLAIM)
    return world
}

const run = (world: MemoryWorld, raw: unknown): Promise<ActionResult> =>
    settleAction.execute?.(memoryProvider(world), raw, SYSTEM_CONTEXT) ?? Promise.reject(new Error("not runnable"))

const runWith = (world: MemoryWorld, entity: string, patch: Partial<EntityApi>, raw: unknown): Promise<ActionResult> =>
    settleAction.execute?.(withEntity(world, entity, patch), raw, SYSTEM_CONTEXT) ??
    Promise.reject(new Error("not runnable"))

const dataOf = (world: MemoryWorld, entity: string, id: string): Readonly<Record<string, unknown>> | undefined =>
    rowsOf(world, entity).find((row) => row.id === id)?.data

/** Every record of the world, as text: what a refusal must leave as it was. */
const snapshotOf = (world: MemoryWorld): string => JSON.stringify([...world.tables.values()].flat())

const answering =
    (result: EngineResult): (() => Promise<EngineResult>) =>
    () =>
        Promise.resolve(result)

/** The amounts of the clean case: the 5,000,000 transfer pays the 5,000,000 order exactly. */
const EXACT = { expectedVnd: 5_000_000, receivedVnd: 5_000_000, differenceVnd: 0 }

describe("sales.settle", () => {
    it("is a transactional action of the accounting permission", () => {
        expect(settleAction.id).toBe("sales.settle")
        expect(settleAction.permission).toBe("sales.manage")
        expect(settleAction.transactional).toBe(true)
        expect(settleAction.refreshes).toEqual([])
    })

    it("keeps on the paid order the account the money came into, from the transaction; matching itself is unchanged", async () => {
        const into = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
        const world = worldOf({ transaction: { ...TRANSACTION, connectionId: into } })
        await expect(run(world, payload)).resolves.toMatchObject({ ok: true, data: { result: "paid" } })
        expect(dataOf(world, "blocks-core.sales.order", ORDER.id)).toMatchObject({ status: "paid", paidConnectionId: into })
    })

    it("writes no account on the order when the transaction names none (a record from before accounts were kept)", async () => {
        const world = worldOf()
        await run(world, payload)
        expect(dataOf(world, "blocks-core.sales.order", ORDER.id)).not.toHaveProperty("paidConnectionId")
    })

    it("ties the transaction to the order, pays it and enqueues the ledger line and the book entry", async () => {
        const world = worldOf()
        await expect(run(world, payload)).resolves.toEqual({ ok: true, data: { result: "paid", orderId: ORDER.id, ...EXACT } })
        expect(dataOf(world, "blocks-core.sales.transaction", TRANSACTION.id)).toMatchObject({
            status: "matched",
            orderId: ORDER.id,
        })
        expect(rowsOf(world, "blocks-core.sales.transaction")[0]?.version).toBe("4")
        expect(dataOf(world, "blocks-core.sales.order", ORDER.id)).toMatchObject({ status: "paid" })
        expect(rowsOf(world, "blocks-core.sales.order")[0]?.version).toBe("3")
        expect(world.links).toContainEqual({
            entity: "blocks-core.sales.transaction",
            id: TRANSACTION.id,
            relation: "order",
            to: ORDER.id,
        })
        expect(world.jobs).toEqual([
            {
                job: "sales.ledger-append",
                input: { transactionId: TRANSACTION.id, orderId: ORDER.id },
                dedupeKey: `ledger:${TRANSACTION.id}`,
            },
            {
                job: "sales.book-project",
                input: { sourceEntity: "blocks-core.sales.transaction", sourceId: TRANSACTION.id },
                dedupeKey: `book:blocks-core.sales.transaction:${TRANSACTION.id}`,
            },
        ])
        expect(world.calls).toEqual([])
    })

    it("settles without the ledger job when the workflow writes the line (the payment.mark-paid executor), and twice is once", async () => {
        const world = worldOf()
        const ports: SettlePorts = {
            transactions: entityApi(world, "blocks-core.sales.transaction"),
            orders: entityApi(world, "blocks-core.sales.order"),
            claims: entityApi(world, "blocks-core.sales.claim"),
            outbox: outbox(world),
        }
        await expect(settleOnOrder(ports, payload, { ledger: false })).resolves.toEqual({
            ok: true,
            data: { result: "paid", orderId: ORDER.id, ...EXACT },
        })
        await expect(settleOnOrder(ports, payload, { ledger: false })).resolves.toEqual({
            ok: true,
            data: { result: "already-paid", orderId: ORDER.id },
        })
        expect(world.jobs.map((job) => job.job)).toEqual(["sales.book-project"])
        expect(dataOf(world, "blocks-core.sales.order", ORDER.id)).toMatchObject({ status: "paid" })
    })

    it("settles the claim that started it", async () => {
        const world = worldOf()
        await expect(run(world, { ...payload, claimId: CLAIM.id })).resolves.toMatchObject({ ok: true })
        expect(dataOf(world, "blocks-core.sales.claim", CLAIM.id)).toMatchObject({
            status: "settled",
            settledTransactionId: TRANSACTION.id,
        })
    })

    it("leaves a claim this very transaction already settled as it is", async () => {
        const world = memoryWorld()
        putTransaction(world, TRANSACTION)
        putOrder(world, ORDER)
        putClaim(world, claimOf({ status: "settled", settledTransactionId: TRANSACTION.id }))
        await expect(run(world, { ...payload, claimId: CLAIM.id })).resolves.toMatchObject({ ok: true })
        expect(rowsOf(world, "blocks-core.sales.claim")[0]?.version).toBe("1")
    })

    it("changes nothing when the transaction already paid the order", async () => {
        const world = worldOf({ transaction: transactionOf({ status: "matched", orderId: ORDER.id }) })
        await expect(run(world, { ...payload, claimId: null })).resolves.toEqual({
            ok: true,
            data: { result: "already-paid", orderId: ORDER.id },
        })
        expect(rowsOf(world, "blocks-core.sales.transaction")[0]?.version).toBe("3")
        expect(rowsOf(world, "blocks-core.sales.order")[0]?.version).toBe("2")
        expect(world.jobs).toEqual([])
    })

    it("refuses what is not clean as data, naming the reason, and writes nothing", async () => {
        const amounts = { receivedVnd: 5_000_000, orderAmountVnd: 5_000_000 }
        const used = "00000000-0000-4000-8000-0000000000b9"
        const cases: ReadonlyArray<readonly [Setup, string, Readonly<Record<string, unknown>>]> = [
            [{ transaction: null }, "transaction_missing", {}],
            [{ order: null }, "order_missing", {}],
            [{ order: orderOf({ status: "paid" }) }, "order_not_open", { ...amounts, status: "paid" }],
            [{ transaction: transactionOf({ orderId: used }) }, "transaction_used", { ...amounts, paidOrderId: used }],
        ]
        for (const [setup, reason, facts] of cases) {
            const world = worldOf(setup)
            const before = snapshotOf(world)
            await expect(run(world, payload)).resolves.toEqual({
                ok: false,
                reason: "refused",
                message: { key: `settle_${reason}` },
                data: { reason, ...facts },
            })
            expect(snapshotOf(world)).toBe(before)
            expect(world.jobs).toEqual([])
        }
    })

    it("refuses a claim that is named but gone", async () => {
        const world = worldOf()
        rowsOf(world, "blocks-core.sales.claim").splice(0)
        await expect(run(world, { ...payload, claimId: CLAIM.id })).resolves.toMatchObject({
            ok: false,
            data: { reason: "claim_missing" },
        })
    })

    it("answers a conflict when another writer got there first, at any of the three writes", async () => {
        const stale: EngineResult = { ok: false, reason: "stale" }
        const expected = { ok: false, reason: "conflict", message: { key: "settle_stale" } }
        await expect(runWith(worldOf(), "blocks-core.sales.transaction", { update: answering(stale) }, payload)).resolves.toEqual(
            expected,
        )
        await expect(runWith(worldOf(), "blocks-core.sales.order", { update: answering(stale) }, payload)).resolves.toEqual(
            expected,
        )
        await expect(
            runWith(worldOf(), "blocks-core.sales.claim", { update: answering(stale) }, { ...payload, claimId: CLAIM.id }),
        ).resolves.toEqual(expected)
    })

    it("refuses with the reason of the row when a write finds it gone", async () => {
        const missing: EngineResult = { ok: false, reason: "missing" }
        await expect(
            runWith(worldOf(), "blocks-core.sales.transaction", { update: answering(missing) }, payload),
        ).resolves.toMatchObject({ ok: false, reason: "refused", data: { reason: "transaction_missing" } })
        await expect(runWith(worldOf(), "blocks-core.sales.order", { update: answering(missing) }, payload)).resolves.toMatchObject(
            { ok: false, data: { reason: "order_missing" } },
        )
        await expect(
            runWith(worldOf(), "blocks-core.sales.claim", { update: answering(missing) }, { ...payload, claimId: CLAIM.id }),
        ).resolves.toMatchObject({ ok: false, data: { reason: "claim_missing" } })
    })

    it("refuses when the database refuses a second link: of the order, of the transaction, of the claim", async () => {
        const taken: EngineResult = {
            ok: false,
            reason: "taken",
            constraint: "order_key",
            refusal: "order-already-paid",
        }
        await expect(
            runWith(worldOf(), "blocks-core.sales.transaction", { update: answering(taken) }, payload),
        ).resolves.toMatchObject({ ok: false, reason: "refused", data: { reason: "order_not_open" } })
        await expect(
            runWith(worldOf(), "blocks-core.sales.transaction", { link: answering(taken) }, payload),
        ).resolves.toMatchObject({ ok: false, reason: "refused", data: { reason: "order_not_open" } })
        await expect(runWith(worldOf(), "blocks-core.sales.order", { update: answering(taken) }, payload)).resolves.toMatchObject({
            ok: false,
            data: { reason: "order_not_open" },
        })
        await expect(
            runWith(worldOf(), "blocks-core.sales.claim", { update: answering(taken) }, { ...payload, claimId: CLAIM.id }),
        ).resolves.toMatchObject({ ok: false, data: { reason: "transaction_used" } })
    })

    it("answers invalid for a payload the door should never have passed", async () => {
        const world = worldOf()
        await expect(run(world, { ...payload, transactionId: "not-a-uuid" })).resolves.toMatchObject({
            ok: false,
            reason: "invalid",
        })
        await expect(run(world, { ...payload, extra: 1 })).resolves.toMatchObject({ ok: false, reason: "invalid" })
    })
})
