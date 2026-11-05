import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { orderOf } from "@tests/fixtures/builders/reconcile-payment-performer.builder"
import { TransactionsService } from "@modules/domain/transactions"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OrdersErrorCode } from "./errors/orders.error"
import { OrderPaymentClaimsService } from "./order-payment-claims.service"
import { OrderPaymentSettlementService } from "./order-payment-settlement.service"
import { OrdersService } from "./orders.service"
import type { PaymentClaimRow } from "./orders.contracts"

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
    const orders = mock<OrdersService>()
    orders.find.mockResolvedValue(orderOf({ id: "order-dinh", lead_id: "lead-dinh" }))
    orders.settle.mockResolvedValue(true)
    const transactions = mock<TransactionsService>()
    const claims = mock<OrderPaymentClaimsService>()
    claims.matching.mockResolvedValue([claim("claim-dinh")])
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderPaymentSettlementService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: OrdersService, useValue: orders },
            { provide: TransactionsService, useValue: transactions },
            { provide: OrderPaymentClaimsService, useValue: claims },
        ],
    }).compile()
    return { service: moduleRef.get(OrderPaymentSettlementService), orders, transactions, claims, tx }
}

describe("OrderPaymentSettlementService", () => {
    it("marks the order paid, links the transaction and settles the customer's claim in one transaction", async () => {
        const { service, orders, transactions, claims, tx } = await build()

        await service.markPaid("ws-1", "order-dinh", "tx-95958515")

        expect(orders.settle).toHaveBeenCalledWith("ws-1", "order-dinh", expect.anything())
        expect(transactions.matchOrder).toHaveBeenCalledWith("ws-1", "tx-95958515", "order-dinh", expect.anything())
        expect(claims.matching).toHaveBeenCalledWith("ws-1", { leadId: "lead-dinh", status: "open" }, 100)
        expect(claims.settle).toHaveBeenCalledWith("ws-1", ["claim-dinh"], "tx-95958515", expect.anything())
        expect(tx.commits).toBe(1)
    })

    it("settles no claim for an order with no customer", async () => {
        const { service, orders, claims } = await build()
        orders.find.mockResolvedValue(null)

        await service.markPaid("ws-1", "order-dinh", "tx-95958515")

        expect(claims.matching).not.toHaveBeenCalled()
        expect(claims.settle).toHaveBeenCalledWith("ws-1", [], "tx-95958515", expect.anything())
    })

    it("refuses an order that no longer waits for money and changes nothing", async () => {
        const { service, orders, transactions, tx } = await build()
        orders.settle.mockResolvedValue(false)

        await expect(service.markPaid("ws-1", "order-dinh", "tx-95958515")).rejects.toMatchObject({
            code: OrdersErrorCode.NotAwaitingPayment,
        })

        expect(transactions.matchOrder).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})
