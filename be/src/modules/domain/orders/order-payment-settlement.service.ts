import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { TransactionsService } from "@modules/domain/transactions"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { OrdersError, OrdersErrorCode } from "./errors/orders.error"
import { OrderPaymentClaimsService } from "./order-payment-claims.service"
import { OrdersService } from "./orders.service"

/** The most open claims of one customer a payment settles. */
const CLAIMS_LIMIT = 100

@Injectable()
/**
 * Marks an order paid by a bank transaction: in one database transaction the order is marked paid (only while it waits for money), the
 * bank transaction is linked to it (one transaction pays one order, by a unique index), and the open claims of the order's customer are
 * settled with that transaction. An order that no longer waits for money refuses, so a second payment never marks it again.
 */
export class OrderPaymentSettlementService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly orders: OrdersService,
        private readonly transactions: TransactionsService,
        private readonly claims: OrderPaymentClaimsService,
    ) {}

    /** Marks the order paid with the transaction and settles the customer's open claims; refuses an order that no longer waits for money. */
    async markPaid(workspaceId: string, orderId: string, transactionId: string): Promise<void> {
        const order = await this.orders.find(workspaceId, orderId)
        await this.entityManager.transaction(async (tx) => {
            if (!(await this.orders.settle(workspaceId, orderId, tx))) {
                throw new OrdersError({ code: OrdersErrorCode.NotAwaitingPayment })
            }
            await this.transactions.matchOrder(workspaceId, transactionId, orderId, tx)
            const leadId = order?.lead_id ?? null
            const open =
                leadId === null ? [] : await this.claims.matching(workspaceId, { leadId, status: "open" }, CLAIMS_LIMIT)
            await this.claims.settle(
                workspaceId,
                open.map((claim) => claim.id),
                transactionId,
                tx,
            )
        })
    }
}
