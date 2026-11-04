import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { OrderPaymentSettlementService } from "./order-payment-settlement.service"
import { PaymentMarkPaidGraphAdapter } from "./payment-mark-paid-graph.adapter"

const turn: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: null,
    locale: "vi",
}

const payload = {
    orderId: "order-dinh",
    transactionId: "tx-95958515",
    evidence: ["Name, amount and the customer message match"],
}

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const settlement = mock<OrderPaymentSettlementService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentMarkPaidGraphAdapter,
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: OrderPaymentSettlementService, useValue: settlement },
        ],
    }).compile()
    return { adapter: moduleRef.get(PaymentMarkPaidGraphAdapter), registry, settlement }
}

describe("PaymentMarkPaidGraphAdapter", () => {
    it("registers itself as the executor of payment.mark-paid", async () => {
        const { adapter, registry } = await build()
        adapter.onModuleInit()
        expect(registry.addExecutor).toHaveBeenCalledWith(adapter)
        expect(adapter.effect).toBe("payment.mark-paid")
    })

    it("marks the order paid with the transaction and answers the order", async () => {
        const { adapter, settlement } = await build()

        await expect(adapter.execute(turn, payload)).resolves.toEqual({ kind: "order", id: "order-dinh" })

        expect(settlement.markPaid).toHaveBeenCalledWith("ws-1", "order-dinh", "tx-95958515")
    })

    it("lets the refusal of an order that no longer waits for money through", async () => {
        const { adapter, settlement } = await build()
        settlement.markPaid.mockRejectedValue(new Error("not awaiting payment"))

        await expect(adapter.execute(turn, payload)).rejects.toThrow("not awaiting payment")
    })
})
