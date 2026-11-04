import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import type { EntityManager } from "typeorm"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { TransactionsService } from "@modules/domain/transactions"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { OrdersError, OrdersErrorCode } from "./errors/orders.error"
import { OrderPaymentClaimsService } from "./order-payment-claims.service"
import { OrdersService } from "./orders.service"

@Injectable()
/**
 * The executor of `payment.mark-paid`: in one transaction the order is marked paid (only while it waits for money), the transaction is
 * linked to it (one transaction pays one order, by a unique index), and the open claims of the order's customer are settled with that
 * transaction. An order that no longer waits for money refuses the effect, so a second payment never marks it again.
 */
export class PaymentMarkPaidGraphAdapter implements NodeEffectExecutor, OnModuleInit {
    readonly effect = "payment.mark-paid"

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly orders: OrdersService,
        private readonly transactions: TransactionsService,
        private readonly claims: OrderPaymentClaimsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executor with the node host once the app has started. */
    onModuleInit(): void {
        this.registry?.addExecutor(this)
    }

    /** Marks the order paid with the transaction, settles the customer's claims, and answers the order. */
    async execute(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const orderId = String(payload.orderId)
        const transactionId = String(payload.transactionId)
        const order = await this.orders.find(turn.workspaceId, orderId)
        await this.entityManager.transaction(async (tx) => {
            if (!(await this.orders.settle(turn.workspaceId, orderId, tx))) {
                throw new OrdersError({ code: OrdersErrorCode.NotAwaitingPayment })
            }
            await this.transactions.matchOrder(turn.workspaceId, transactionId, orderId, tx)
            const leadId = order?.lead_id ?? null
            const open =
                leadId === null ? [] : await this.claims.query(turn.workspaceId, { leadId, status: "open" }, 100)
            await this.claims.settle(
                turn.workspaceId,
                open.map((claim) => claim.id),
                transactionId,
                tx,
            )
        })
        return { kind: "order", id: orderId }
    }
}
