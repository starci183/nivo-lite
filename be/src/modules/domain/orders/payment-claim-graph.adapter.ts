import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectCall, EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { OrderPaymentClaimsService } from "./order-payment-claims.service"
import { PaymentDemandService } from "./payment-demand.service"

const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

@Injectable()
/**
 * The executor of `payment-claim.record`, which writes what a customer said about paying once per business key and has the bank-feed
 * connections polled fast for a while. The `payment-claim` data kind is the entity engine's. Escalating a claim whose money never came is
 * `escalate`, which the work-item executor calls for the `claimId` of its payload.
 */
export class PaymentClaimGraphAdapter implements NodeEffectExecutor, OnModuleInit {
    readonly effect = "payment-claim.record"

    constructor(
        private readonly claims: OrderPaymentClaimsService,
        private readonly demand: PaymentDemandService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executor with the node host once the app has started. */
    onModuleInit(): void {
        this.registry?.addExecutor(this)
    }

    /** Records what the customer said, once per business key (or per run step), and answers the claim. */
    async execute(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<SubjectRef> {
        const id = await this.claims.record({
            workspaceId: turn.workspaceId,
            leadId: textOf(payload.leadId) ?? null,
            conversationId: textOf(payload.conversationId) ?? null,
            amountVnd: typeof payload.amountVnd === "number" ? payload.amountVnd : null,
            names: Array.isArray(payload.names) ? payload.names.map(String) : [],
            body: String(payload.body),
            dedupeKey: call.dedupeKey ?? call.key,
        })
        await this.demand.claimOpen(turn.workspaceId)
        return { kind: "payment-claim", id }
    }

    /** Hands an open claim to the owner; false when it was no longer open, so a claim is escalated once. */
    escalate(workspaceId: string, claimId: string): Promise<boolean> {
        return this.claims.escalate(workspaceId, claimId)
    }
}
