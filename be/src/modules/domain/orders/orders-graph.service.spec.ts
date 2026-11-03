import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { LeadReadService } from "@modules/domain/leads"
import { orderOf } from "@tests/fixtures/builders/confirm-order-performer.builder"
import { OrdersErrorCode } from "./errors/orders.error"
import { OrdersGraphService } from "./orders-graph.service"
import { OrderConfirmationService } from "./order-confirmation.service"
import { OrdersService } from "./orders.service"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: null,
    locale: "vi",
}
const CALL = { key: "k", dedupeKey: null }

const build = async (withRegistry = true) => {
    const orders = mock<OrdersService>()
    const leads = mock<LeadReadService>()
    const confirmation = mock<OrderConfirmationService>()
    const registry = mock<GraphNodeRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrdersGraphService,
            { provide: OrdersService, useValue: orders },
            { provide: LeadReadService, useValue: leads },
            { provide: OrderConfirmationService, useValue: confirmation },
            ...(withRegistry ? [{ provide: GraphNodeRegistryService, useValue: registry }] : []),
        ],
    }).compile()
    const service = moduleRef.get(OrdersGraphService)
    service.onModuleInit()
    const port = registry.addDataPort.mock.calls[0]?.[0] as NodeDataPort
    const executors = new Map(
        registry.addExecutor.mock.calls.map(([executor]) => [executor.effect, executor as NodeEffectExecutor]),
    )
    return { orders, leads, confirmation, registry, port, executors }
}

const FIELDS = ["id", "orderNo", "leadId", "items", "note", "amountVnd", "status", "confirmedAt", "createdAt"]

describe("OrdersGraphService", () => {
    it("registers the order port and the two executors", async () => {
        const { registry, port, executors } = await build()

        expect(registry.addDataPort).toHaveBeenCalledTimes(1)
        expect(port.kind).toBe("order")
        expect([...executors.keys()]).toEqual(["order.record", "order.confirm"])
    })

    it("serves nothing when the app hosts no graph nodes", async () => {
        const { registry } = await build(false)

        expect(registry.addDataPort).not.toHaveBeenCalled()
    })

    it("reads the order named by the turn subject, with its items as lines", async () => {
        const { orders, port } = await build()
        orders.find.mockResolvedValue(orderOf({ items: "2 x tea, 1 x cake", note: "12 Le Loi", status: "confirmed" }))

        const rows = await port.read({ ...TURN, subject: { kind: "order", id: "ord-1" } }, { fields: FIELDS }, "turn")

        expect(orders.find).toHaveBeenCalledWith("ws-1", "ord-1")
        expect(rows).toEqual([
            {
                id: "ord-1",
                orderNo: "SO-1",
                leadId: "lead-1",
                items: [
                    { name: "tea", qty: 2 },
                    { name: "cake", qty: 1 },
                ],
                note: "12 Le Loi",
                amountVnd: 300000,
                status: "confirmed",
                confirmedAt: null,
                createdAt: "2026-10-12T09:00:00.000Z",
            },
        ])
    })

    it("reads the orders of the customer the turn is about, filtered by where", async () => {
        const { orders, port } = await build()
        orders.listForLead.mockResolvedValue([
            { ...orderOf({ id: "a", status: "draft" }), contact_name: null } as never,
            orderOf({ id: "b", status: "confirmed" }) as never,
        ])

        const rows = await port.read(
            { ...TURN, subject: { kind: "sales-lead", id: "lead-1" } },
            { where: { status: "confirmed" }, fields: ["id"] },
            "turn",
        )

        expect(orders.listForLead).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(rows).toEqual([{ id: "b" }])
    })

    it("reads no order for a turn about nothing, or about an order that is gone", async () => {
        const { orders, port } = await build()
        orders.find.mockResolvedValue(null)

        await expect(port.read(TURN, { fields: ["id"] }, "turn")).resolves.toEqual([])
        await expect(
            port.read({ ...TURN, subject: { kind: "order", id: "x" } }, { fields: ["id"] }, "turn"),
        ).resolves.toEqual([])
        expect(orders.listForLead).not.toHaveBeenCalled()
    })

    it("reads the workspace orders for a workspace scope, and only that workspace", async () => {
        const { orders, port } = await build()
        orders.list.mockResolvedValue([orderOf() as never])

        await expect(port.read(TURN, { fields: ["orderNo"] }, "workspace")).resolves.toEqual([{ orderNo: "SO-1" }])
        expect(orders.list).toHaveBeenCalledWith("ws-1", 500)
    })

    it("records a draft order for a customer of the workspace, with the items in its text and the note in its own column", async () => {
        const { orders, leads, executors } = await build()
        orders.draft.mockResolvedValue(orderOf({ id: "new-1" }))

        const subject = await executors.get("order.record")?.execute(
            TURN,
            {
                leadId: "lead-1",
                items: [
                    { name: "tea", qty: 2, unitPriceVnd: 5 },
                    { name: "cake", qty: 1 },
                ],
                amountVnd: 11,
                note: "12 Le Loi",
            },
            CALL,
        )

        expect(leads.require).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(orders.draft).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            inboundEventId: null,
            orderNo: null,
            items: "2 x tea, 1 x cake",
            note: "12 Le Loi",
            amountVnd: 11,
        })
        expect(subject).toEqual({ kind: "order", id: "new-1" })
    })

    it("records an order without a note", async () => {
        const { orders, executors } = await build()
        orders.draft.mockResolvedValue(orderOf({ id: "new-2" }))

        await executors
            .get("order.record")
            ?.execute(TURN, { leadId: "lead-1", items: [{ name: "tea", qty: 1 }], amountVnd: null }, CALL)

        expect(orders.draft.mock.calls[0]?.[0]).toMatchObject({ items: "1 x tea", note: "", amountVnd: null })
    })

    it("refuses to record for a customer the workspace does not have", async () => {
        const { orders, leads, executors } = await build()
        leads.require.mockRejectedValue(new Error("not found"))

        await expect(
            executors
                .get("order.record")
                ?.execute(TURN, { leadId: "other", items: [{ name: "tea", qty: 1 }], amountVnd: null }, CALL),
        ).rejects.toThrow("not found")
        expect(orders.draft).not.toHaveBeenCalled()
    })

    it("confirms a draft order with its own amount and items", async () => {
        const { orders, confirmation, executors } = await build()
        orders.find.mockResolvedValue(orderOf({ status: "draft" }))

        const subject = await executors.get("order.confirm")?.execute(TURN, { orderId: "ord-1" }, CALL)

        expect(confirmation.confirm).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            orderId: "ord-1",
            amountVnd: 300000,
            items: "2 tea boxes",
            confirmedBy: "NIVO",
            customer: "",
        })
        expect(subject).toEqual({ kind: "order", id: "ord-1" })
    })

    it("leaves an order that is already confirmed as it is", async () => {
        const { orders, confirmation, executors } = await build()
        orders.find.mockResolvedValue(orderOf({ status: "confirmed" }))

        await expect(executors.get("order.confirm")?.execute(TURN, { orderId: "ord-1" }, CALL)).resolves.toEqual({
            kind: "order",
            id: "ord-1",
        })
        expect(confirmation.confirm).not.toHaveBeenCalled()
    })

    it("refuses an order that is not in the workspace", async () => {
        const { orders, executors } = await build()
        orders.find.mockResolvedValue(null)

        await expect(executors.get("order.confirm")?.execute(TURN, { orderId: "x" }, CALL)).rejects.toMatchObject({
            code: OrdersErrorCode.NotFound,
        })
    })
})
