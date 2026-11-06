import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { EngineResult, EntitiesApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { OutboxApi } from "@nivo-lite/agent-sdk/mutation"
import type { SubjectRef } from "@nivo-lite/agent-sdk/node"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { OrderEffectsService } from "./order-effects.service"
import { SalesEffectsErrorCode } from "./errors/sales-effects.error"

const WORKSPACE = "11111111-1111-4111-8111-111111111111"
const LEAD = "33333333-3333-4333-8333-333333333333"
const ORDER = "44444444-4444-4444-8444-444444444444"
const NOW = new Date("2026-11-05T09:30:00.000Z")

const TURN: NodeTurn = {
    turnId: "t",
    workspaceId: WORKSPACE,
    agentId: "a-1",
    subject: null,
    conversationId: null,
    locale: "vi",
}

const CALL = { key: "k", dedupeKey: null }

const recordOf = (id: string, version: string, data: Readonly<Record<string, unknown>>): RecordRow => ({
    id,
    workspaceId: WORKSPACE,
    version,
    createdAt: "2026-11-05T09:00:00.000Z",
    updatedAt: "2026-11-05T09:00:00.000Z",
    data,
})

const orderRecord = (data: Readonly<Record<string, unknown>> = {}): RecordRow =>
    recordOf(ORDER, "4", {
        orderNo: "DH-20261105-0001",
        leadId: LEAD,
        items: { lines: [{ name: "tea", qty: 2, unitVnd: 0, amountVnd: 0 }] },
        itemsText: "2 x tea",
        note: "",
        amountVnd: 120_000,
        status: "draft",
        ...data,
    })

const leadRecord = (stage: string): RecordRow => recordOf(LEAD, "7", { contactName: "Lan", channel: "zalo", stage })

const ok = (row: RecordRow): EngineResult => ({ ok: true, row, version: row.version })

const build = async () => {
    const engine = mock<EntityEngineService>()
    const ports = mock<EntityPortsService>()
    const registry = mock<GraphNodeRegistryService>()
    const api = mock<EntitiesApi>()
    const tx = mock<ScopedTx>()
    const outbox = mock<OutboxApi>()
    engine.scoped.mockImplementation((_workspace, work) => work(tx))
    api.list.mockResolvedValue({ rows: [], next: null })
    ports.entitiesApi.mockReturnValue(api)
    ports.outboxApi.mockReturnValue(outbox)
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderEffectsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    moduleRef.get(OrderEffectsService).onModuleInit()
    const executors = new Map(registry.addExecutor.mock.calls.map(([executor]) => [executor.effect, executor]))
    const executorOf = (effect: string): NodeEffectExecutor => {
        const found = executors.get(effect)
        assert(found !== undefined, `The service must register an executor for ${effect}`)
        return found
    }
    return { engine, registry, api, outbox, executorOf }
}

const run = (executor: NodeEffectExecutor, payload: Readonly<Record<string, unknown>>): Promise<SubjectRef> =>
    executor.execute(TURN, payload, CALL)

describe("OrderEffectsService registration", () => {
    it("registers the executors of order.record, order.confirm, order.void and payment.rematch", async () => {
        const { executorOf } = await build()
        expect(
            ["order.record", "order.confirm", "order.void", "payment.rematch"].map(
                (effect) => executorOf(effect).effect,
            ),
        ).toEqual(["order.record", "order.confirm", "order.void", "payment.rematch"])
    })

    it("does nothing when the app hosts no graph nodes", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                OrderEffectsService,
                { provide: CLOCK, useValue: new FakeClock(NOW) },
                { provide: EntityEngineService, useValue: mock<EntityEngineService>() },
                { provide: EntityPortsService, useValue: mock<EntityPortsService>() },
            ],
        }).compile()
        expect(() => moduleRef.get(OrderEffectsService).onModuleInit()).not.toThrow()
    })
})

const TEA_AND_CAKE = {
    lines: [
        { name: "tea", qty: 2, unitVnd: 0, amountVnd: 0 },
        { name: "cake", qty: 1, unitVnd: 0, amountVnd: 0 },
    ],
}

const RECORD_PAYLOAD = {
    leadId: LEAD,
    items: [
        { name: "tea", qty: 2 },
        { name: "cake", qty: 1 },
    ],
    amountVnd: 120_000,
    note: "Leave at the door",
}

describe("OrderEffectsService order.record", () => {
    it("makes a draft for the customer, linked to it, with its lines and the text of them", async () => {
        const { executorOf, api, engine } = await build()
        api.get.mockResolvedValue(leadRecord("new"))
        api.insert.mockResolvedValue(ok(orderRecord()))

        await expect(run(executorOf("order.record"), RECORD_PAYLOAD)).resolves.toEqual({ kind: "order", id: ORDER })

        expect(engine.scoped).toHaveBeenCalledWith(WORKSPACE, expect.any(Function))
        expect(api.insert).toHaveBeenCalledWith(
            "sales.order",
            {
                leadId: LEAD,
                items: TEA_AND_CAKE,
                itemsText: "2 x tea, 1 x cake",
                amountVnd: 120_000,
                note: "Leave at the door",
            },
            { lead: LEAD },
        )
    })

    it("leaves the note out when there is none and keeps an unknown total", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(leadRecord("new"))
        api.insert.mockResolvedValue(ok(orderRecord()))

        await run(executorOf("order.record"), { ...RECORD_PAYLOAD, note: undefined, amountVnd: null })

        expect(api.insert).toHaveBeenCalledWith(
            "sales.order",
            { leadId: LEAD, items: TEA_AND_CAKE, itemsText: "2 x tea, 1 x cake", amountVnd: null },
            { lead: LEAD },
        )
    })

    it.each([
        ["no items", { ...RECORD_PAYLOAD, items: [] }],
        ["a total that is no whole number", { ...RECORD_PAYLOAD, amountVnd: 1.5 }],
    ])("refuses a payload with %s", async (_label, bad) => {
        const { executorOf } = await build()
        await expect(run(executorOf("order.record"), bad)).rejects.toMatchObject({
            code: "SALES_EFFECTS_INVALID_PAYLOAD",
        })
    })

    it("refuses a customer the workspace has not, and an id that is no record id", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(null)
        await expect(run(executorOf("order.record"), RECORD_PAYLOAD)).rejects.toMatchObject({
            code: "SALES_EFFECTS_LEAD_NOT_FOUND",
        })
        api.get.mockClear()
        await expect(run(executorOf("order.record"), { ...RECORD_PAYLOAD, leadId: "lead-1" })).rejects.toMatchObject({
            code: "SALES_EFFECTS_LEAD_NOT_FOUND",
        })
        expect(api.get).not.toHaveBeenCalled()
    })

    it("refuses when the engine does not make the order", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(leadRecord("new"))
        api.insert.mockResolvedValue({ ok: false, reason: "invalid" })
        await expect(run(executorOf("order.record"), RECORD_PAYLOAD)).rejects.toMatchObject({
            code: "SALES_EFFECTS_WRITE_REFUSED",
        })
    })
})

describe("OrderEffectsService order.record of a request that stands", () => {
    const listed = (...records: ReadonlyArray<RecordRow>) => ({
        rows: records.map((row) => ({ row, joined: {}, position: [], included: {} })),
        next: null,
    })
    const STANDING = {
        items: {
            lines: [
                { name: "tea", qty: 2, unitVnd: 0, amountVnd: 0 },
                { name: "cake", qty: 1, unitVnd: 0, amountVnd: 0 },
            ],
        },
        amountVnd: 120_000,
        note: "Leave at the door",
        status: "confirmed",
    }

    it("looks for an open order of the customer first, newest first, among drafts and confirmed ones", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(leadRecord("new"))
        api.insert.mockResolvedValue(ok(orderRecord()))

        await run(executorOf("order.record"), RECORD_PAYLOAD)

        expect(api.list).toHaveBeenCalledWith(
            expect.objectContaining({
                from: "sales.order",
                where: {
                    op: "and",
                    of: [
                        { op: "eq", field: "leadId", value: LEAD },
                        { op: "in", field: "status", values: ["draft", "confirmed"] },
                    ],
                },
                order: [
                    ["createdAt", "desc"],
                    ["id", "desc"],
                ],
            }),
        )
    })

    it("reuses the open order that already stands for the same request, and writes nothing", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(leadRecord("new"))
        api.list.mockResolvedValue(listed(orderRecord(STANDING)))

        await expect(run(executorOf("order.record"), RECORD_PAYLOAD)).resolves.toEqual({ kind: "order", id: ORDER })
        await expect(run(executorOf("order.record"), RECORD_PAYLOAD)).resolves.toEqual({ kind: "order", id: ORDER })

        expect(api.insert).not.toHaveBeenCalled()
    })

    it("records a new order when the open ones ask for something else, or cannot be read", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(leadRecord("new"))
        api.insert.mockResolvedValue(ok(orderRecord()))
        api.list.mockResolvedValue(
            listed(
                orderRecord({ ...STANDING, amountVnd: 99_000 }),
                recordOf("55555555-5555-4555-8555-555555555555", "1", { status: 7 }),
            ),
        )

        await run(executorOf("order.record"), RECORD_PAYLOAD)

        expect(api.insert).toHaveBeenCalledTimes(1)
    })
})

describe("OrderEffectsService order.confirm", () => {
    it("confirms a draft in the name of the agent, and wins the customer's deal", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValueOnce(orderRecord()).mockResolvedValueOnce(leadRecord("proposal"))
        api.update.mockResolvedValue(ok(orderRecord()))

        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).resolves.toEqual({
            kind: "order",
            id: ORDER,
        })

        expect(api.update).toHaveBeenNthCalledWith(1, "sales.order", ORDER, "4", {
            status: "confirmed",
            confirmedBy: "NIVO",
            confirmedAt: "2026-11-05T09:30:00.000Z",
        })
        expect(api.update).toHaveBeenNthCalledWith(2, "sales.lead", LEAD, "7", { stage: "won", closedReason: null })
    })

    it("leaves the deal alone when it is won already, was lost, or the order has no customer", async () => {
        const { executorOf, api } = await build()
        api.update.mockResolvedValue(ok(orderRecord()))
        for (const stage of ["won", "lost"]) {
            api.get.mockResolvedValueOnce(orderRecord()).mockResolvedValueOnce(leadRecord(stage))
            await run(executorOf("order.confirm"), { orderId: ORDER })
        }
        api.get.mockResolvedValueOnce(orderRecord({ leadId: null }))
        await run(executorOf("order.confirm"), { orderId: ORDER })
        api.get.mockResolvedValueOnce(orderRecord()).mockResolvedValueOnce(null)
        await run(executorOf("order.confirm"), { orderId: ORDER })
        expect(api.update).toHaveBeenCalledTimes(4)
    })

    it("changes nothing for an order that is no draft", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(orderRecord({ status: "confirmed" }))
        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).resolves.toEqual({
            kind: "order",
            id: ORDER,
        })
        expect(api.update).not.toHaveBeenCalled()
    })

    it("refuses a payload without an order, an order the workspace has not, and an id that is no record id", async () => {
        const { executorOf, api } = await build()
        await expect(run(executorOf("order.confirm"), {})).rejects.toMatchObject({
            code: "SALES_EFFECTS_INVALID_PAYLOAD",
        })
        api.get.mockResolvedValue(null)
        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).rejects.toMatchObject({
            code: "SALES_EFFECTS_ORDER_NOT_FOUND",
        })
        await expect(run(executorOf("order.confirm"), { orderId: "o-1" })).rejects.toMatchObject({
            code: "SALES_EFFECTS_ORDER_NOT_FOUND",
        })
        api.get.mockResolvedValue(recordOf(ORDER, "1", { status: "lost" }))
        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).rejects.toMatchObject({
            code: "SALES_EFFECTS_ORDER_NOT_FOUND",
        })
    })

    it("refuses when the order moved under it, and when the deal did", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(orderRecord())
        api.update.mockResolvedValueOnce({ ok: false, reason: "stale" })
        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).rejects.toMatchObject({
            code: "SALES_EFFECTS_WRITE_REFUSED",
        })
        api.get.mockResolvedValueOnce(orderRecord()).mockResolvedValueOnce(leadRecord("new"))
        api.update.mockResolvedValueOnce(ok(orderRecord())).mockResolvedValueOnce({ ok: false, reason: "stale" })
        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).rejects.toMatchObject({
            code: "SALES_EFFECTS_WRITE_REFUSED",
        })
    })
})

describe("OrderEffectsService order.void", () => {
    it("marks the order failed_system and keeps every other field", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(orderRecord())
        api.update.mockResolvedValue(ok(orderRecord()))

        await expect(run(executorOf("order.void"), { id: ORDER })).resolves.toEqual({ kind: "order", id: ORDER })

        expect(api.update).toHaveBeenCalledWith("sales.order", ORDER, "4", { status: "failed_system" })
    })

    it("changes nothing for an order that already is failed_system, is gone, or is no order id", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValueOnce(orderRecord({ status: "failed_system" }))
        await run(executorOf("order.void"), { id: ORDER })
        api.get.mockResolvedValueOnce(null)
        await expect(run(executorOf("order.void"), { id: ORDER })).resolves.toEqual({ kind: "order", id: ORDER })
        await expect(run(executorOf("order.void"), { id: "o-1" })).resolves.toEqual({ kind: "order", id: "o-1" })
        expect(api.update).not.toHaveBeenCalled()
    })

    it("refuses a payload without an id, and a write the engine does not make", async () => {
        const { executorOf, api } = await build()
        await expect(run(executorOf("order.void"), {})).rejects.toMatchObject({
            code: "SALES_EFFECTS_INVALID_PAYLOAD",
        })
        api.get.mockResolvedValue(orderRecord())
        api.update.mockResolvedValue({ ok: false, reason: "stale" })
        await expect(run(executorOf("order.void"), { id: ORDER })).rejects.toMatchObject({
            code: "SALES_EFFECTS_WRITE_REFUSED",
        })
    })
})

describe("OrderEffectsService payment.rematch", () => {
    it("enqueues the rematch job of the order with the instant of the run, once under the effect key of the call", async () => {
        const { executorOf, api, outbox } = await build()
        api.get.mockResolvedValue(orderRecord())

        await expect(
            executorOf("payment.rematch").execute(
                TURN,
                { orderId: ORDER },
                { key: "k", dedupeKey: `payment-rematch:${ORDER}` },
            ),
        ).resolves.toEqual({ kind: "order", id: ORDER })

        expect(outbox.enqueue).toHaveBeenCalledWith(
            expect.objectContaining({ name: "payment.rematch" }),
            { orderId: ORDER, at: "2026-11-05T09:30:00.000Z" },
            { dedupeKey: `payment-rematch:${ORDER}` },
        )
    })

    it("falls back to the step key when the node gave no business key, and refuses an order that is not there", async () => {
        const { executorOf, api, outbox } = await build()
        api.get.mockResolvedValueOnce(orderRecord()).mockResolvedValueOnce(null)

        await run(executorOf("payment.rematch"), { orderId: ORDER })
        expect(outbox.enqueue).toHaveBeenCalledWith(expect.anything(), expect.anything(), { dedupeKey: "k" })

        await expect(run(executorOf("payment.rematch"), { orderId: ORDER })).rejects.toMatchObject({
            code: SalesEffectsErrorCode.OrderNotFound,
        })
        await expect(run(executorOf("payment.rematch"), { orderId: "not-an-id" })).rejects.toMatchObject({
            code: SalesEffectsErrorCode.OrderNotFound,
        })
    })
})
