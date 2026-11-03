import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectCall, EffectPayload, NodeQuery, SubjectRef } from "@nivo-lite/agent-sdk/node"
import type { RightScope } from "@nivo-lite/agent-sdk/rights"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeEffectExecutor, NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { OrderPaymentClaimsService } from "./order-payment-claims.service"
import type { PaymentClaimRow, PaymentClaimStatus, PaymentClaimWhere } from "./orders.contracts"

/** The most rows one read of the port answers. */
const READ_LIMIT = 200

const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

/** The equalities of a query the claims table can answer: id, lead, conversation and status. */
const whereOf = (query: NodeQuery): PaymentClaimWhere => {
    const { id, leadId, conversationId, status } = query.where ?? {}
    const known = { id: textOf(id), leadId: textOf(leadId), conversationId: textOf(conversationId), status: textOf(status) }
    return Object.fromEntries(Object.entries(known).filter(([, value]) => value !== undefined)) as PaymentClaimWhere
}

/** A claim as the `payment-claim` data kind yields it. */
const viewOf = (claim: PaymentClaimRow): NodeRow => ({
    id: claim.id,
    leadId: claim.leadId,
    conversationId: claim.conversationId,
    amountVnd: claim.amountVnd,
    names: claim.names,
    body: claim.body,
    claimedAt: claim.claimedAt.toISOString(),
    status: claim.status satisfies PaymentClaimStatus,
})

/** The fields the query asked for, nothing more. */
const cut = (row: NodeRow, fields: ReadonlyArray<string>): NodeRow =>
    Object.fromEntries(fields.map((field) => [field, row[field]]))

@Injectable()
/**
 * The graph nodes' door to what customers said about paying: the data port of the `payment-claim` kind (a `turn` read keeps to the
 * conversation of the turn, a `workspace` read reaches the workspace's claims) and the executor of `payment-claim.record`, which writes the
 * claim once per business key. Escalating a claim whose money never came is `escalate`, which the work-item executor calls for the
 * `claimId` of its payload.
 */
export class PaymentClaimGraphAdapter implements NodeDataPort, NodeEffectExecutor, OnModuleInit {
    readonly kind = "payment-claim"
    readonly effect = "payment-claim.record"

    constructor(
        private readonly registry: GraphNodeRegistryService,
        private readonly claims: OrderPaymentClaimsService,
    ) {}

    /** Registers the port and the executor with the node host once the app has started. */
    onModuleInit(): void {
        this.registry.addDataPort(this)
        this.registry.addExecutor(this)
    }

    /** Reads the claims of the query, cut to its fields. */
    async read(turn: NodeTurn, query: NodeQuery, scope: RightScope): Promise<ReadonlyArray<NodeRow>> {
        if (scope === "turn" && turn.conversationId === null) return []
        const where = whereOf(query)
        const scoped = scope === "turn" && turn.conversationId !== null ? { ...where, conversationId: turn.conversationId } : where
        const rows = await this.claims.query(turn.workspaceId, scoped, query.limit ?? READ_LIMIT)
        return rows.map((claim) => cut(viewOf(claim), query.fields))
    }

    /** Records what the customer said, once per business key (or per run step), and answers the claim. */
    async execute(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<SubjectRef> {
        const id = await this.claims.record({
            workspaceId: turn.workspaceId,
            leadId: String(payload.leadId),
            conversationId: textOf(payload.conversationId) ?? null,
            amountVnd: typeof payload.amountVnd === "number" ? payload.amountVnd : null,
            names: Array.isArray(payload.names) ? payload.names.map(String) : [],
            body: String(payload.body),
            dedupeKey: call.dedupeKey ?? call.key,
        })
        return { kind: "payment-claim", id }
    }

    /** Hands an open claim to the owner; false when it was no longer open, so a claim is escalated once. */
    escalate(workspaceId: string, claimId: string): Promise<boolean> {
        return this.claims.escalate(workspaceId, claimId)
    }
}
