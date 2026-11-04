import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { TransactionsService } from "@modules/domain/transactions"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { orderOf } from "@tests/fixtures/builders/reconcile-payment-performer.builder"
import { OrdersErrorCode } from "./errors/orders.error"
import { OrderPaymentClaimsService } from "./order-payment-claims.service"
import { OrdersService } from "./orders.service"
import type { PaymentClaimRow } from "./orders.contracts"
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
    evidence: ["Tên, số tiền và lời báo của khách khớp"],
}

const claim = (id: string): PaymentClaimRow => ({
    id,
    workspaceId: "ws-1",
    leadId: "lead-dinh",
    conversationId: "conversation-dinh",
    amountVnd: 5000,
    names: [],
    body: "5k",
    claimedAt: new Date("2026-11-04T00:54:00.000Z"),
    status: "open",
})

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const orders = mock<OrdersService>()
    orders.find.mockResolvedValue(orderOf({ id: "order-dinh", lead_id: "lead-dinh" }))
    orders.settle.mockResolvedValue(true)
    const transactions = mock<TransactionsService>()
    const claims = mock<OrderPaymentClaimsService>()
    claims.query.mockResolvedValue([claim("claim-dinh")])
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentMarkPaidGraphAdapter,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: OrdersService, useValue: orders },
            { provide: TransactionsService, useValue: transactions },
            { provide: OrderPaymentClaimsService, useValue: claims },
        ],
    }).compile()
    return { adapter: moduleRef.get(PaymentMarkPaidGraphAdapter), registry, orders, transactions, claims, tx }
}

describe("PaymentMarkPaidGraphAdapter", () => {
    it("registers itself as the executor of payment.mark-paid", async () => {
        const { adapter, registry } = await build()
        adapter.onModuleInit()
        expect(registry.addExecutor).toHaveBeenCalledWith(adapter)
        expect(adapter.effect).toBe("payment.mark-paid")
    })

    it("marks the order paid, links the transaction and settles his claim in one transaction", async () => {
        const { adapter, orders, transactions, claims, tx } = await build()

        await expect(adapter.execute(turn, payload)).resolves.toEqual({ kind: "order", id: "order-dinh" })

        expect(orders.settle).toHaveBeenCalledWith("ws-1", "order-dinh", expect.anything())
        expect(transactions.matchOrder).toHaveBeenCalledWith("ws-1", "tx-95958515", "order-dinh", expect.anything())
        expect(claims.query).toHaveBeenCalledWith("ws-1", { leadId: "lead-dinh", status: "open" }, 100)
        expect(claims.settle).toHaveBeenCalledWith("ws-1", ["claim-dinh"], "tx-95958515", expect.anything())
        expect(tx.commits).toBe(1)
    })

    it("settles no claim for an order with no customer", async () => {
        const { adapter, orders, claims } = await build()
        orders.find.mockResolvedValue(null)

        await adapter.execute(turn, payload)

        expect(claims.query).not.toHaveBeenCalled()
        expect(claims.settle).toHaveBeenCalledWith("ws-1", [], "tx-95958515", expect.anything())
    })

    it("refuses an order that no longer waits for money and changes nothing", async () => {
        const { adapter, orders, transactions, tx } = await build()
        orders.settle.mockResolvedValue(false)

        await expect(adapter.execute(turn, payload)).rejects.toMatchObject({ code: OrdersErrorCode.NotAwaitingPayment })

        expect(transactions.matchOrder).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})
