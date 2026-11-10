import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { EngineResult, EntitiesApi, EntityApi, ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { OutboxApi } from "@nivo-lite/agent-sdk/mutation"
import type { EffectCall } from "@nivo-lite/agent-sdk/node"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { PaymentTimersService } from "./payment-timers.service"
import { PaymentEffectsService } from "./payment-effects.service"

const WORKSPACE = "11111111-1111-4111-8111-111111111111"
const CONVERSATION = "22222222-2222-4222-8222-222222222222"
const LEAD = "33333333-3333-4333-8333-333333333333"
const ORDER = "44444444-4444-4444-8444-444444444444"
const TRANSACTION = "55555555-5555-4555-8555-555555555555"
const CLAIM = "66666666-6666-4666-8666-666666666666"
const NOW = "2026-11-09T06:00:00.000Z"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: WORKSPACE,
    agentId: "agent-1",
    subject: null,
    conversationId: CONVERSATION,
    locale: "vi",
}

const CLAIM_CALL: EffectCall = { key: "step-1:0", dedupeKey: "payment-claim:turn-1" }
const PAID_CALL: EffectCall = { key: "step-2:0", dedupeKey: `paid:${TRANSACTION}` }

const recordOf = (id: string, data: Readonly<Record<string, unknown>>, version = "1"): RecordRow => ({
    id,
    workspaceId: WORKSPACE,
    version,
    createdAt: NOW,
    updatedAt: NOW,
    data,
})

const written = (id: string): EngineResult => ({ ok: true, row: recordOf(id, {}), version: "2", created: true })
const taken: EngineResult = { ok: false, reason: "taken", constraint: "dedupe_key", refusal: "claim-already-recorded" }

const pageOf = (rows: ReadonlyArray<RecordRow>, joined: Readonly<Record<string, string>> = {}): ListPage => ({
    rows: rows.map((row) => ({
        row,
        joined: Object.fromEntries(Object.entries(joined).map(([name, id]) => [name, { id, data: {} }])),
        position: [],
        included: {},
    })),
    next: null,
})

const credit = (orderId: string | null): RecordRow =>
    recordOf(TRANSACTION, {
        direction: "credit",
        amountVnd: 2000,
        reference: "DH202611090003",
        payer: null,
        orderId,
        occurredAt: NOW,
        status: orderId === null ? "unmatched" : "matched",
    })

const order = (status: string): RecordRow => recordOf(ORDER, { orderNo: "DH-20261109-0003", amountVnd: 2000, status })

const build = async () => {
    const engine = mock<EntityEngineService>()
    const ports = mock<EntityPortsService>()
    const registry = mock<GraphNodeRegistryService>()
    const api = mock<EntitiesApi>()
    const tx = mock<ScopedTx>()
    const entities = { transactions: mock<EntityApi>(), orders: mock<EntityApi>(), claims: mock<EntityApi>() }
    const outbox = mock<OutboxApi>()
    engine.scoped.mockImplementation((_workspace, work) => work(tx))
    ports.entitiesApi.mockReturnValue(api)
    ports.outboxApi.mockReturnValue(outbox)
    ports.entityApi.mockImplementation((_runIn, _by, entity) => {
        if (entity === "payment.transaction") return entities.transactions
        if (entity === "sales.order") return entities.orders
        return entities.claims
    })
    for (const each of [entities.transactions, entities.orders])
        each.update.mockImplementation((key) => Promise.resolve(written(key)))
    entities.transactions.link.mockResolvedValue(written(TRANSACTION))
    outbox.enqueue.mockResolvedValue(undefined)
    const timers = mock<PaymentTimersService>({ closeOf: jest.fn().mockResolvedValue(2) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentEffectsService,
            { provide: PaymentTimersService, useValue: timers },
            { provide: CLOCK, useValue: new FakeClock(Date.parse(NOW)) },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    moduleRef.get(PaymentEffectsService).onModuleInit()
    const byEffect = new Map(registry.addExecutor.mock.calls.map(([executor]) => [executor.effect, executor]))
    const executorOf = (effect: string): NodeEffectExecutor => {
        const found = byEffect.get(effect)
        assert(found !== undefined, `no executor for ${effect}`)
        return found
    }
    return { api, entities, outbox, registry, executorOf, timers }
}

describe("PaymentEffectsService registration", () => {
    it("registers the three payment effects the graphs run and that were unserved", async () => {
        const { registry } = await build()
        expect(registry.addExecutor.mock.calls.map(([executor]) => executor.effect)).toEqual([
            "payment.order.settle",
            "payment.claim.record",
            "payment.claim.cancel",
        ])
    })
})

describe("PaymentEffectsService payment.mark-paid", () => {
    const payload = { orderId: ORDER, transactionId: TRANSACTION }
    const priced = (amountVnd: number | null, status = "confirmed"): RecordRow =>
        recordOf(ORDER, { orderNo: "DH-20261109-0003", amountVnd, status })

    it("matches the credit to the order, marks it paid and answers the amounts of the two records; no notice and no ledger job", async () => {
        const { entities, outbox, executorOf } = await build()
        entities.transactions.get.mockResolvedValue(credit(null))
        entities.orders.get.mockResolvedValue(order("paid"))
        entities.orders.list.mockResolvedValue(pageOf([order("confirmed")], { lead: LEAD }))

        await expect(executorOf("payment.order.settle").execute(TURN, payload, PAID_CALL)).resolves.toEqual({
            kind: "order",
            id: ORDER,
            facts: {
                result: "paid",
                transactionId: TRANSACTION,
                orderNo: "DH-20261109-0003",
                expectedVnd: 2000,
                receivedVnd: 2000,
                differenceVnd: 0,
            },
        })

        expect(entities.transactions.update).toHaveBeenCalledWith(TRANSACTION, "1", {
            status: "matched",
            orderId: ORDER,
        })
        expect(entities.transactions.link).toHaveBeenCalledWith(TRANSACTION, "order", ORDER)
        expect(entities.orders.update).toHaveBeenCalledWith(ORDER, "1", { status: "paid" })
        expect(outbox.enqueue.mock.calls.map(([job]) => job.name)).toEqual(["accounting.book-project"])
    })

    it("closes the order's payment timers once it is paid, and keeps them when the settle is refused", async () => {
        const paid = await build()
        paid.entities.transactions.get.mockResolvedValue(credit(null))
        paid.entities.orders.get.mockResolvedValue(order("paid"))
        paid.entities.orders.list.mockResolvedValue(pageOf([order("confirmed")], { lead: LEAD }))
        await paid.executorOf("payment.order.settle").execute(TURN, payload, PAID_CALL)
        expect(paid.timers.closeOf).toHaveBeenCalledWith(TURN.workspaceId, ORDER)

        const refused = await build()
        refused.entities.transactions.get.mockResolvedValue(credit(null))
        refused.entities.orders.list.mockResolvedValue(pageOf([order("cancelled")], { lead: LEAD }))
        await refused.executorOf("payment.order.settle").execute(TURN, payload, PAID_CALL)
        expect(refused.timers.closeOf).not.toHaveBeenCalled()
    })

    it("is idempotent: a credit that already paid the order writes nothing and says so", async () => {
        const { entities, outbox, executorOf } = await build()
        entities.transactions.get.mockResolvedValue(credit(ORDER))
        entities.orders.get.mockResolvedValue(order("paid"))
        entities.orders.list.mockResolvedValue(pageOf([order("paid")], { lead: LEAD }))

        await expect(executorOf("payment.order.settle").execute(TURN, payload, PAID_CALL)).resolves.toMatchObject({
            kind: "order",
            id: ORDER,
            facts: { result: "already_paid" },
        })
        expect(entities.orders.update).not.toHaveBeenCalled()
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })

    it("answers an order that no longer awaits payment as a refusal fact with its status, never a throw, and pays nothing", async () => {
        const { entities, executorOf } = await build()
        entities.transactions.get.mockResolvedValue(credit(null))
        entities.orders.list.mockResolvedValue(pageOf([order("cancelled")], { lead: LEAD }))

        await expect(executorOf("payment.order.settle").execute(TURN, payload, PAID_CALL)).resolves.toEqual({
            kind: "refused",
            id: "order_not_open",
            facts: { receivedVnd: 2000, orderAmountVnd: 2000, status: "cancelled" },
        })
        expect(entities.orders.update).not.toHaveBeenCalled()
    })

    it.each([
        ["short", 3000, -1000],
        ["over", 1000, 1000],
    ])(
        "pays an order a %s credit settles and answers the true difference, never a refusal on the amount",
        async (_case, dueVnd, differenceVnd) => {
            const { entities, executorOf } = await build()
            entities.transactions.get.mockResolvedValue(credit(null))
            entities.orders.list.mockResolvedValue(pageOf([priced(dueVnd)], { lead: LEAD }))
            entities.orders.get.mockResolvedValue(priced(dueVnd, "paid"))

            await expect(executorOf("payment.order.settle").execute(TURN, payload, PAID_CALL)).resolves.toMatchObject({
                kind: "order",
                facts: { result: "paid", expectedVnd: dueVnd, receivedVnd: 2000, differenceVnd },
            })
            expect(entities.orders.update).toHaveBeenCalledWith(ORDER, "1", { status: "paid" })
        },
    )

    const setUpSettle = async () => {
        const built = await build()
        built.api.get.mockResolvedValue(recordOf(ORDER, { leadId: LEAD }))
        built.entities.transactions.get.mockResolvedValue(credit(null))
        built.entities.orders.list.mockResolvedValue(pageOf([order("confirmed")], { lead: LEAD }))
        built.entities.claims.list.mockResolvedValue(
            pageOf([recordOf(CLAIM, { status: "open", leadId: LEAD, conversationId: CONVERSATION, names: { values: [] } })]),
        )
        built.entities.claims.update.mockResolvedValue(written(CLAIM))
        return built
    }

    it("settles the claims linked to the order, though the caller names none, and not a claim tied to another order", async () => {
        const { api, entities, executorOf } = await setUpSettle()
        const OTHER = "77777777-7777-4777-8777-777777777777"
        const LINKED = "88888888-8888-4888-8888-888888888888"
        api.list.mockResolvedValue({
            rows: [
                { row: recordOf(OTHER, { status: "open" }), joined: { order: { id: "other-order", data: {} } }, position: [], included: {} },
                { row: recordOf(CLAIM, { status: "open" }), joined: { order: { id: ORDER, data: {} } }, position: [], included: {} },
                { row: recordOf(LINKED, { status: "escalated" }), joined: { order: { id: ORDER, data: {} } }, position: [], included: {} },
            ],
            next: null,
        })
        entities.claims.get.mockResolvedValue(recordOf(CLAIM, { status: "open" }))
        entities.claims.get.mockImplementation((id) => Promise.resolve(recordOf(id, { status: "escalated" })))

        await expect(executorOf("payment.order.settle").execute(TURN, payload, PAID_CALL)).resolves.toMatchObject({
            kind: "order",
        })
        const closed = entities.claims.update.mock.calls.map(([id]) => id)
        expect(closed).toEqual(expect.arrayContaining([CLAIM, LINKED]))
        expect(closed).not.toContain(OTHER)
    })

    it("settles no claim when none is linked to the order and the caller names none", async () => {
        const { api, entities, executorOf } = await setUpSettle()
        api.list.mockResolvedValue(pageOf([recordOf(CLAIM, { status: "open" })]))

        await executorOf("payment.order.settle").execute(TURN, payload, PAID_CALL)
        expect(entities.claims.update).not.toHaveBeenCalled()
    })

    it("settles the claim the caller names, and looks no further", async () => {
        const { api, entities, executorOf } = await setUpSettle()
        entities.claims.get.mockResolvedValue(recordOf(CLAIM, { status: "open", leadId: LEAD }))

        await executorOf("payment.order.settle").execute(TURN, { ...payload, claimId: CLAIM }, PAID_CALL)
        expect(api.list).not.toHaveBeenCalled()
        expect(entities.claims.update).toHaveBeenCalledWith(CLAIM, "1", {
            status: "settled",
            settledTransactionId: TRANSACTION,
        })
    })

    it("answers an id that names no record as a refusal fact", async () => {
        const { executorOf } = await build()
        await expect(
            executorOf("payment.order.settle").execute(TURN, { ...payload, orderId: "x" }, PAID_CALL),
        ).resolves.toEqual({ kind: "refused", id: "order_missing", facts: {} })
        await expect(
            executorOf("payment.order.settle").execute(TURN, { ...payload, transactionId: "x" }, PAID_CALL),
        ).resolves.toEqual({ kind: "refused", id: "transaction_missing", facts: {} })
    })

    it("rolls back and throws when another writer moved the order under the settlement (a stale write is not a business refusal)", async () => {
        const { entities, executorOf } = await build()
        entities.transactions.get.mockResolvedValue(credit(null))
        entities.orders.list.mockResolvedValue(pageOf([order("confirmed")], { lead: LEAD }))
        entities.orders.update.mockResolvedValue({ ok: false, reason: "stale" })

        await expect(executorOf("payment.order.settle").execute(TURN, payload, PAID_CALL)).rejects.toMatchObject({
            code: "SALES_EFFECTS_WRITE_REFUSED",
        })
    })
})

describe("PaymentEffectsService payment-claim.record", () => {
    const said = {
        leadId: LEAD,
        conversationId: CONVERSATION,
        amountVnd: 2000,
        names: ["NGUYEN VAN A"],
        body: "da chuyen",
    }

    it("ties the claim to the order the agent names, when it is the customer's own", async () => {
        const { api, executorOf } = await build()
        api.list.mockResolvedValueOnce(pageOf([]))
        api.get.mockResolvedValue(recordOf(ORDER, { leadId: LEAD }))
        api.insert.mockResolvedValue(written(CLAIM))

        await expect(
            executorOf("payment.claim.record").execute(TURN, { ...said, orderId: ORDER }, CLAIM_CALL),
        ).resolves.toEqual({ kind: "payment-claim", id: CLAIM, facts: { orderId: ORDER } })
        expect(api.insert).toHaveBeenCalledWith(
            "payment.claim",
            {
                leadId: LEAD,
                conversationId: CONVERSATION,
                amountVnd: 2000,
                names: { values: ["NGUYEN VAN A"] },
                body: "da chuyen",
                status: "open",
                claimedAt: NOW,
                dedupeKey: "payment-claim:turn-1",
            },
            { conversation: CONVERSATION, order: ORDER },
        )
    })

    it("refuses an order that is not the customer's and records nothing", async () => {
        const { api, executorOf } = await build()
        api.list.mockResolvedValueOnce(pageOf([]))
        api.get.mockResolvedValue(recordOf(ORDER, { leadId: "99999999-9999-4999-8999-999999999999" }))

        await expect(
            executorOf("payment.claim.record").execute(TURN, { ...said, orderId: ORDER }, CLAIM_CALL),
        ).resolves.toEqual({ kind: "refused", id: "order_not_of_customer", facts: { orderId: ORDER } })
        expect(api.insert).not.toHaveBeenCalled()
    })

    it("ties no order the agent did not name, and lists the orders awaiting payment as facts, one or several", async () => {
        const { api, executorOf } = await build()
        const second = recordOf("77777777-7777-4777-8777-777777777777", { orderNo: "DH-2", amountVnd: 5000 })
        api.list.mockResolvedValueOnce(pageOf([])).mockResolvedValueOnce(pageOf([order("confirmed"), second]))
        api.insert.mockResolvedValue(written(CLAIM))

        await expect(executorOf("payment.claim.record").execute(TURN, said, CLAIM_CALL)).resolves.toEqual({
            kind: "payment-claim",
            id: CLAIM,
            facts: {
                orderId: null,
                awaitingOrders: [
                    { orderId: ORDER, orderNo: "DH-20261109-0003", amountVnd: 2000 },
                    { orderId: "77777777-7777-4777-8777-777777777777", orderNo: "DH-2", amountVnd: 5000 },
                ],
            },
        })
        expect(api.insert).toHaveBeenCalledWith("payment.claim", expect.anything(), { conversation: CONVERSATION })
    })

    it("is idempotent: a claim already recorded under the dedupe key is answered and nothing is inserted", async () => {
        const { api, executorOf } = await build()
        api.list.mockResolvedValue(pageOf([recordOf(CLAIM, { status: "open" })]))

        await expect(executorOf("payment.claim.record").execute(TURN, said, CLAIM_CALL)).resolves.toEqual({
            kind: "payment-claim",
            id: CLAIM,
        })
        expect(api.insert).not.toHaveBeenCalled()
    })

    it("answers the claim of the run that won a race on the dedupe key", async () => {
        const { api, executorOf } = await build()
        api.list
            .mockResolvedValueOnce(pageOf([]))
            .mockResolvedValueOnce(pageOf([]))
            .mockResolvedValueOnce(pageOf([recordOf(CLAIM, { status: "open" })]))
        api.insert.mockResolvedValue(taken)

        await expect(executorOf("payment.claim.record").execute(TURN, said, CLAIM_CALL)).resolves.toEqual({
            kind: "payment-claim",
            id: CLAIM,
        })
    })

    it("refuses a conversation that is no record", async () => {
        const { executorOf } = await build()
        await expect(
            executorOf("payment.claim.record").execute(TURN, { ...said, conversationId: "c1" }, CLAIM_CALL),
        ).rejects.toMatchObject({ code: "SALES_EFFECTS_CONVERSATION_NOT_FOUND" })
    })
})

describe("PaymentEffectsService payment-claim.withdraw", () => {
    it("withdraws an open claim once", async () => {
        const { api, executorOf } = await build()
        api.get.mockResolvedValue(recordOf(CLAIM, { status: "open" }))
        api.update.mockResolvedValue(written(CLAIM))

        await expect(executorOf("payment.claim.cancel").execute(TURN, { id: CLAIM }, CLAIM_CALL)).resolves.toEqual({
            kind: "payment-claim",
            id: CLAIM,
        })
        expect(api.update).toHaveBeenCalledWith("payment.claim", CLAIM, "1", { status: "withdrawn" })
    })

    it.each([
        ["withdrawn", recordOf(CLAIM, { status: "withdrawn" })],
        ["settled", recordOf(CLAIM, { status: "settled" })],
        ["gone", null],
    ])("changes nothing for a claim that is %s", async (_label, found) => {
        const { api, executorOf } = await build()
        api.get.mockResolvedValue(found)

        await executorOf("payment.claim.cancel").execute(TURN, { id: CLAIM }, CLAIM_CALL)
        expect(api.update).not.toHaveBeenCalled()
    })
})
