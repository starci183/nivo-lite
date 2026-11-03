import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { OrderPaymentClaimsService } from "./order-payment-claims.service"

@Injectable()
/**
 * The executor of `payment-claim.withdraw`, the undo of `payment-claim.record`: a claim a failed run recorded is taken back while it is
 * still open. A claim already settled by money, escalated to the owner or withdrawn stays as it is, so the undo is idempotent and never
 * undoes a payment.
 */
export class PaymentClaimWithdrawGraphAdapter implements NodeEffectExecutor, OnModuleInit {
    readonly effect = "payment-claim.withdraw"

    constructor(
        private readonly claims: OrderPaymentClaimsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executor with the node host once the app has started. */
    onModuleInit(): void {
        this.registry?.addExecutor(this)
    }

    /** Withdraws the claim if it is still open and answers it. */
    async execute(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const id = String(payload.id)
        await this.claims.withdraw(turn.workspaceId, id)
        return { kind: "payment-claim", id }
    }
}
