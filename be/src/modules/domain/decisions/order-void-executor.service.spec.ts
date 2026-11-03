import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { orderOf } from "@tests/fixtures/builders/confirm-order-performer.builder"
import { OrderVoidExecutorService } from "./order-void-executor.service"
import { WorkEngineService } from "./work-engine.service"

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
    const leads = mock<LeadRecordsService>()
    const engine = mock<WorkEngineService>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}|${JSON.stringify(params)}`)
    const registry = mock<GraphNodeRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderVoidExecutorService,
            { provide: OrdersService, useValue: orders },
            { provide: LeadRecordsService, useValue: leads },
            { provide: WorkEngineService, useValue: engine },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            ...(withRegistry ? [{ provide: GraphNodeRegistryService, useValue: registry }] : []),
        ],
    }).compile()
    moduleRef.get(OrderVoidExecutorService).onModuleInit()
    return { orders, leads, engine, registry, executor: registry.addExecutor.mock.calls[0]?.[0] as NodeEffectExecutor }
}

describe("OrderVoidExecutorService", () => {
    it("registers the order.void executor, and nothing when the app hosts no graph nodes", async () => {
        const { executor } = await build()
        const { registry } = await build(false)

        expect(executor.effect).toBe("order.void")
        expect(registry.addExecutor).not.toHaveBeenCalled()
    })

    it("marks the order failed_system, keeps it, and raises one owner item keyed by the order", async () => {
        const { orders, leads, engine, executor } = await build()
        orders.markFailedSystem.mockResolvedValue(orderOf({ status: "failed_system" }))
        leads.find.mockResolvedValue({ contact_name: "Lan" } as never)

        const subject = await executor.execute(TURN, { id: "ord-1" }, CALL)

        expect(orders.markFailedSystem).toHaveBeenCalledWith("ws-1", "ord-1")
        expect(leads.find).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(engine.runWork).toHaveBeenCalledTimes(1)
        expect(engine.runWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
            {
                action: "order_failed_system",
                subject_type: "order",
                subject_id: "ord-1",
                lead_id: "lead-1",
                dedupeKey: "order-void:ord-1",
                seed: {
                    summary: 'engine.orderFailedSystem|{"customer":"Lan"}',
                    amount_vnd: 300000,
                    fields: { orderId: "ord-1", orderNo: "SO-1" },
                },
                preset: true,
                forceAsk: "branch_ask",
            },
        )
        expect(subject).toEqual({ kind: "order", id: "ord-1" })
    })

    it("names an order without a customer by its number", async () => {
        const { orders, leads, engine, executor } = await build()
        orders.markFailedSystem.mockResolvedValue(orderOf({ lead_id: null }))

        await executor.execute(TURN, { id: "ord-1" }, CALL)

        expect(leads.find).not.toHaveBeenCalled()
        expect(engine.runWork.mock.calls[0]?.[1].seed?.summary).toBe('engine.orderFailedSystem|{"customer":"SO-1"}')
    })

    it("names the order by its number when the customer record is gone", async () => {
        const { orders, leads, engine, executor } = await build()
        orders.markFailedSystem.mockResolvedValue(orderOf())
        leads.find.mockResolvedValue(null)

        await executor.execute(TURN, { id: "ord-1" }, CALL)

        expect(engine.runWork.mock.calls[0]?.[1].seed?.summary).toContain("SO-1")
    })

    it("does nothing for an order that already is failed_system, or is not in the workspace", async () => {
        const { orders, engine, executor } = await build()
        orders.markFailedSystem.mockResolvedValue(null)

        await expect(executor.execute(TURN, { id: "ord-1" }, CALL)).resolves.toEqual({ kind: "order", id: "ord-1" })
        expect(engine.runWork).not.toHaveBeenCalled()
    })
})
