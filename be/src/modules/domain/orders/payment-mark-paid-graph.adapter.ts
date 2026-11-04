import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { OrderPaymentSettlementService } from "./order-payment-settlement.service"

@Injectable()
/**
 * The executor of `payment.mark-paid`: the order is marked paid with the bank transaction and the open claims of its customer are
 * settled, all in the one transaction of the settlement service. An order that no longer waits for money refuses the effect, so a second
 * payment never marks it again.
 */
export class PaymentMarkPaidGraphAdapter implements NodeEffectExecutor, OnModuleInit {
    readonly effect = "payment.mark-paid"

    constructor(
        private readonly settlement: OrderPaymentSettlementService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executor with the node host once the app has started. */
    onModuleInit(): void {
        this.registry?.addExecutor(this)
    }

    /** Marks the order paid with the transaction, settles the customer's claims, and answers the order. */
    async execute(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const orderId = String(payload.orderId)
        await this.settlement.markPaid(turn.workspaceId, orderId, String(payload.transactionId))
        return { kind: "order", id: orderId }
    }
}
