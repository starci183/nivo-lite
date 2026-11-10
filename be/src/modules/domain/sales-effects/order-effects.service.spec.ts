import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { EngineResult, EntitiesApi, EntityApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { OutboxApi } from "@nivo-lite/agent-sdk/mutation"
import type { SubjectRef } from "@nivo-lite/agent-sdk/node"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
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

const TEA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

/** The shop's catalogue: tea and cake are priced, the vase is not, and the old basket is no longer sold. */
const CATALOGUE = [
    { id: TEA_ID, name: "Trà sen", priceVnd: 40_000, active: true },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Cake", priceVnd: 50_000, active: true },
    { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Vase", priceVnd: null, active: true },
    { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Old basket", priceVnd: 10_000, active: false },
]

const ok = (row: RecordRow): EngineResult => ({ ok: true, row, version: row.version })

const build = async () => {
    const engine = mock<EntityEngineService>()
    const ports = mock<EntityPortsService>()
    const registry = mock<GraphNodeRegistryService>()
    const api = mock<EntitiesApi>()
    const tx = mock<ScopedTx>()
    const outbox = mock<OutboxApi>()
    const settings = mock<EntityApi>()
    const catalogue = mock<NodeDataPort>()
    engine.scoped.mockImplementation((_workspace, work) => work(tx))
    api.list.mockResolvedValue({ rows: [], next: null })
    settings.list.mockResolvedValue({ rows: [], next: null })
    catalogue.read.mockResolvedValue(CATALOGUE)
    registry.portOf.mockReturnValue(catalogue)
    ports.entitiesApi.mockReturnValue(api)
    ports.entityApi.mockReturnValue(settings)
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
    return { engine, registry, api, outbox, settings, catalogue, executorOf }
}

const run = (executor: NodeEffectExecutor, payload: Readonly<Record<string, unknown>>): Promise<SubjectRef> =>
    executor.execute(TURN, payload, CALL)

describe("OrderEffectsService registration", () => {
    it("registers the executors of order.record, order.confirm, order.void and payment.rematch", async () => {
        const { executorOf } = await build()
        expect(
            ["order.create", "order.confirm", "order.cancel", "payment.credit.rematch"].map(
                (effect) => executorOf(effect).effect,
            ),
        ).toEqual(["order.create", "order.confirm", "order.cancel", "payment.credit.rematch"])
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

const PRICED = {
    lines: [
        { name: "Trà sen", qty: 2, unitVnd: 40_000, amountVnd: 80_000 },
        { name: "Cake", qty: 1, unitVnd: 50_000, amountVnd: 50_000 },
    ],
}

const RECORD_PAYLOAD = {
    leadId: LEAD,
    items: [
        { catalogueItemId: TEA_ID, qty: 2 },
        { name: "  cake ", qty: 1 },
    ],
    address: "25 Nguyen Hue",
    recipientPhone: " 0901 234 567 ",
    deliveryAt: "thứ Bảy 9-11h",
    note: "Leave at the door",
}

const priced = (data: Readonly<Record<string, unknown>> = {}): RecordRow =>
    orderRecord({
        items: PRICED,
        itemsText: "2 x Trà sen, 1 x Cake",
        amountVnd: 130_000,
        recipientName: null,
        recipientPhone: "0901 234 567",
        deliveryAddress: "25 Nguyen Hue",
        deliveryAt: "thứ Bảy 9-11h",
        ...data,
    })

describe("OrderEffectsService order.record", () => {
    it("prices every line from the catalogue (by id, else by name), keeps the recipient phone and delivery time in their own fields, and answers the lines, the total and the owner threshold", async () => {
        const { executorOf, api, catalogue } = await build()
        api.get.mockResolvedValue(leadRecord("new"))
        api.insert.mockResolvedValue(ok(priced({ note: "Leave at the door", deliveryAddress: "25 Nguyen Hue" })))

        await expect(run(executorOf("order.create"), RECORD_PAYLOAD)).resolves.toEqual({
            kind: "order",
            id: ORDER,
            facts: {
                orderNo: "DH-20261105-0001",
                status: "draft",
                amountVnd: 130_000,
                lines: PRICED.lines,
                recipientName: null,
                recipientPhone: "0901 234 567",
                deliveryAddress: "25 Nguyen Hue",
                deliveryAt: "thứ Bảy 9-11h",
                waitsOwner: false,
                thresholdVnd: 5_000_000,
            },
        })

        expect(catalogue.read).toHaveBeenCalledWith(
            TURN,
            { fields: ["id", "name", "priceVnd", "active"], limit: 500 },
            "workspace",
        )
        expect(api.insert).toHaveBeenCalledWith(
            "sales.order",
            {
                leadId: LEAD,
                items: PRICED,
                itemsText: "2 x Trà sen, 1 x Cake",
                amountVnd: 130_000,
                note: "Leave at the door",
                deliveryAddress: "25 Nguyen Hue",
                recipientName: null,
                recipientPhone: "0901 234 567",
                deliveryAt: "thứ Bảy 9-11h",
            },
            { lead: LEAD },
        )
    })

    it("takes no price and no total from the caller: numbers typed into the payload never reach the order", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(leadRecord("new"))
        api.insert.mockResolvedValue(ok(priced()))
        const typed = {
            leadId: LEAD,
            items: [{ name: "Trà sen", qty: 2, unitPriceVnd: 1, unitVnd: 1 }],
            amountVnd: 2,
        }

        await run(executorOf("order.create"), typed)

        expect(api.insert).toHaveBeenCalledWith(
            "sales.order",
            expect.objectContaining({
                items: { lines: [{ name: "Trà sen", qty: 2, unitVnd: 40_000, amountVnd: 80_000 }] },
                amountVnd: 80_000,
            }),
            { lead: LEAD },
        )
    })

    it("says an order at the owner threshold waits for the owner", async () => {
        const { executorOf, api, settings } = await build()
        settings.list.mockResolvedValue({
            rows: [
                {
                    row: recordOf("s", "1", {
                        key: "default",
                        approvalThresholdVnd: 100_000,
                        draftWithoutTotalNeedsApproval: true,
                        closedDealsCanFlip: false,
                        reopenNeedsApproval: true,
                        maxDiscountPct: 0,
                        remindAfterDays: 2,
                        autoWon: true,
                        notifyAccounting: true,
                    }),
                    joined: {},
                    position: [],
                    included: {},
                },
            ],
            next: null,
        })
        api.get.mockResolvedValue(leadRecord("new"))
        api.insert.mockResolvedValue(ok(priced()))

        await expect(run(executorOf("order.create"), RECORD_PAYLOAD)).resolves.toMatchObject({
            facts: { waitsOwner: true, thresholdVnd: 100_000 },
        })
    })

    it.each([
        ["item_unknown", { name: "orchid", qty: 1 }, "orchid"],
        ["item_unknown", { name: "Old basket", qty: 1 }, "Old basket"],
        ["item_unpriced", { name: "vase", qty: 1 }, "Vase"],
    ])("refuses %s as a fact that names the item, and writes nothing", async (reason, item, name) => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(leadRecord("new"))

        await expect(run(executorOf("order.create"), { leadId: LEAD, items: [item] })).resolves.toEqual({
            kind: "refused",
            id: reason,
            facts: { name },
        })
        expect(api.insert).not.toHaveBeenCalled()
    })

    it("refuses a customer the workspace has not as a fact, and a payload that is not an order as an invalid payload", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(null)
        await expect(run(executorOf("order.create"), RECORD_PAYLOAD)).resolves.toEqual({
            kind: "refused",
            id: "lead_missing",
            facts: {},
        })
        await expect(run(executorOf("order.create"), { leadId: LEAD, items: [] })).rejects.toMatchObject({
            code: SalesEffectsErrorCode.InvalidPayload,
        })
    })

    it("throws when the engine does not make the order", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(leadRecord("new"))
        api.insert.mockResolvedValue({ ok: false, reason: "stale" })
        await expect(run(executorOf("order.create"), RECORD_PAYLOAD)).rejects.toMatchObject({
            code: SalesEffectsErrorCode.WriteRefused,
        })
    })

    it("rewrites the draft the caller names for this customer instead of recording a second order", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValueOnce(leadRecord("new")).mockResolvedValueOnce(orderRecord())
        api.update.mockResolvedValue(ok(priced()))

        await expect(run(executorOf("order.create"), { ...RECORD_PAYLOAD, orderId: ORDER })).resolves.toMatchObject({
            kind: "order",
            id: ORDER,
        })
        expect(api.update).toHaveBeenCalledWith("sales.order", ORDER, "4", {
            items: PRICED,
            itemsText: "2 x Trà sen, 1 x Cake",
            amountVnd: 130_000,
            note: "Leave at the door",
            deliveryAddress: "25 Nguyen Hue",
            recipientName: null,
            recipientPhone: "0901 234 567",
            deliveryAt: "thứ Bảy 9-11h",
        })
        expect(api.insert).not.toHaveBeenCalled()
    })

    it("records a new order when the named one is no longer a draft", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValueOnce(leadRecord("new")).mockResolvedValueOnce(orderRecord({ status: "confirmed" }))
        api.insert.mockResolvedValue(ok(priced()))

        await run(executorOf("order.create"), { ...RECORD_PAYLOAD, orderId: ORDER })
        expect(api.update).not.toHaveBeenCalled()
        expect(api.insert).toHaveBeenCalledTimes(1)
    })

    it("reuses the open order that already stands for the same request, and writes nothing", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(leadRecord("new"))
        api.list.mockResolvedValue({
            rows: [
                {
                    row: priced({ note: "Leave at the door", deliveryAddress: "25 Nguyen Hue" }),
                    joined: {},
                    position: [],
                    included: {},
                },
            ],
            next: null,
        })

        await expect(run(executorOf("order.create"), RECORD_PAYLOAD)).resolves.toMatchObject({
            kind: "order",
            id: ORDER,
        })
        expect(api.insert).not.toHaveBeenCalled()
        expect(api.update).not.toHaveBeenCalled()
    })
})

describe("OrderEffectsService order.confirm", () => {
    it("confirms a draft in the name of the agent, answers the deal's stage as a fact and moves no deal", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValueOnce(orderRecord()).mockResolvedValueOnce(leadRecord("proposal"))
        api.update.mockResolvedValue(ok(orderRecord()))

        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).resolves.toMatchObject({
            kind: "order",
            id: ORDER,
            facts: { orderNo: "DH-20261105-0001", status: "confirmed", amountVnd: 120_000, dealStage: "proposal" },
        })

        expect(api.update).toHaveBeenCalledTimes(1)
        expect(api.update).toHaveBeenCalledWith("sales.order", ORDER, "4", {
            status: "confirmed",
            confirmedBy: "NIVO",
            confirmedAt: "2026-11-05T09:30:00.000Z",
        })
    })

    it("confirms an order at or above the owner threshold too: the threshold is policy the agent reasons about, not a refusal", async () => {
        const { executorOf, api } = await build()
        api.get
            .mockResolvedValueOnce(orderRecord({ amountVnd: 5_000_000 }))
            .mockResolvedValueOnce(leadRecord("proposal"))
        api.update.mockResolvedValue(ok(orderRecord()))

        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).resolves.toMatchObject({
            kind: "order",
            id: ORDER,
            facts: { orderNo: "DH-20261105-0001", status: "confirmed", amountVnd: 5_000_000 },
        })
        expect(api.update).toHaveBeenNthCalledWith(1, "sales.order", ORDER, "4", {
            status: "confirmed",
            confirmedBy: "NIVO",
            confirmedAt: "2026-11-05T09:30:00.000Z",
        })
    })

    it("answers ok without writing once the owner confirmed the order", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(orderRecord({ status: "confirmed", amountVnd: 9_000_000 }))
        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).resolves.toMatchObject({
            kind: "order",
            facts: { status: "confirmed", amountVnd: 9_000_000 },
        })
        expect(api.update).not.toHaveBeenCalled()
    })

    it("never writes the deal, whatever its stage, and answers no stage for an order without a customer", async () => {
        const { executorOf, api } = await build()
        api.update.mockResolvedValue(ok(orderRecord()))
        for (const stage of ["won", "lost"]) {
            api.get.mockResolvedValueOnce(orderRecord()).mockResolvedValueOnce(leadRecord(stage))
            await run(executorOf("order.confirm"), { orderId: ORDER })
        }
        api.get.mockResolvedValueOnce(orderRecord({ leadId: null }))
        await run(executorOf("order.confirm"), { orderId: ORDER })
        api.get.mockResolvedValueOnce(orderRecord()).mockResolvedValueOnce(null)
        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).resolves.toMatchObject({
            facts: { dealStage: null },
        })
        expect(api.update).toHaveBeenCalledTimes(4)
        expect(api.update.mock.calls.every(([entity]) => entity === "sales.order")).toBe(true)
    })

    it("refuses a cancelled order and an order the workspace has not as facts, and a payload without an order as invalid", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValueOnce(orderRecord({ status: "cancelled" }))
        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).resolves.toEqual({
            kind: "refused",
            id: "not_confirmable",
            facts: { status: "cancelled" },
        })
        api.get.mockResolvedValueOnce(null)
        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).resolves.toMatchObject({
            id: "order_missing",
        })
        await expect(run(executorOf("order.confirm"), { orderId: "o-1" })).resolves.toMatchObject({
            id: "order_missing",
        })
        await expect(run(executorOf("order.confirm"), {})).rejects.toMatchObject({
            code: SalesEffectsErrorCode.InvalidPayload,
        })
    })

    it("throws when the order moved under it", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValueOnce(orderRecord()).mockResolvedValueOnce(leadRecord("proposal"))
        api.update.mockResolvedValueOnce({ ok: false, reason: "stale" })
        await expect(run(executorOf("order.confirm"), { orderId: ORDER })).rejects.toMatchObject({
            code: SalesEffectsErrorCode.WriteRefused,
        })
    })
})

describe("OrderEffectsService order.void", () => {
    it("marks the order failed_system and keeps every other field", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValue(orderRecord())
        api.update.mockResolvedValue(ok(orderRecord()))

        await expect(run(executorOf("order.cancel"), { id: ORDER })).resolves.toEqual({ kind: "order", id: ORDER })

        expect(api.update).toHaveBeenCalledWith("sales.order", ORDER, "4", { status: "failed_system" })
    })

    it("changes nothing for an order that already is failed_system, is gone, or is no order id", async () => {
        const { executorOf, api } = await build()
        api.get.mockResolvedValueOnce(orderRecord({ status: "failed_system" }))
        await run(executorOf("order.cancel"), { id: ORDER })
        api.get.mockResolvedValueOnce(null)
        await expect(run(executorOf("order.cancel"), { id: ORDER })).resolves.toEqual({ kind: "order", id: ORDER })
        await expect(run(executorOf("order.cancel"), { id: "o-1" })).resolves.toEqual({ kind: "order", id: "o-1" })
        expect(api.update).not.toHaveBeenCalled()
    })

    it("refuses a payload without an id, and a write the engine does not make", async () => {
        const { executorOf, api } = await build()
        await expect(run(executorOf("order.cancel"), {})).rejects.toMatchObject({
            code: "SALES_EFFECTS_INVALID_PAYLOAD",
        })
        api.get.mockResolvedValue(orderRecord())
        api.update.mockResolvedValue({ ok: false, reason: "stale" })
        await expect(run(executorOf("order.cancel"), { id: ORDER })).rejects.toMatchObject({
            code: "SALES_EFFECTS_WRITE_REFUSED",
        })
    })
})

describe("OrderEffectsService payment.rematch", () => {
    it("enqueues the rematch job of the order with the instant of the run, once under the effect key of the call", async () => {
        const { executorOf, api, outbox } = await build()
        api.get.mockResolvedValue(orderRecord())

        await expect(
            executorOf("payment.credit.rematch").execute(
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

        await run(executorOf("payment.credit.rematch"), { orderId: ORDER })
        expect(outbox.enqueue).toHaveBeenCalledWith(expect.anything(), expect.anything(), { dedupeKey: "k" })

        await expect(run(executorOf("payment.credit.rematch"), { orderId: ORDER })).rejects.toMatchObject({
            code: SalesEffectsErrorCode.OrderNotFound,
        })
        await expect(run(executorOf("payment.credit.rematch"), { orderId: "not-an-id" })).rejects.toMatchObject({
            code: SalesEffectsErrorCode.OrderNotFound,
        })
    })
})
