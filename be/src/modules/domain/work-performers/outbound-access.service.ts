import { Injectable } from "@nestjs/common"
import { AgentBindingsService, PURPOSES } from "@modules/domain/agent-connections"
import type { BoundAgent } from "@modules/domain/agent-connections"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentsService } from "@modules/domain/agents"
import type { OutboundAccess, OutboundAccessGate, Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { textOf } from "./performer.policy"

const RANK: Readonly<Record<OutboundAccess, number>> = { read: 0, ask: 1, auto: 2 }

/** The access of the agent that owns the connection, or the strongest grant of it when the department's own agent is not bound. */
const strongest = (grants: ReadonlyArray<BoundAgent>): OutboundAccess =>
    grants.reduce<OutboundAccess>((best, grant) => (RANK[grant.access] > RANK[best] ? grant.access : best), "read")

@Injectable()
/**
 * How far the item's department agent may act on the connection the message would leave through: the conversation named in the proposal,
 * else the customer's latest conversation. "auto" when there is no connection (website chat) or nothing is bound.
 */
export class OutboundAccessService implements OutboundAccessGate {
    constructor(
        private readonly conversations: AgentConversationsService,
        private readonly bindings: AgentBindingsService,
        private readonly agents: AgentsService,
    ) {}

    /** The access the item's department agent has on the connection of the conversation the message answers in. */
    async accessOf(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<OutboundAccess> {
        const conversationId = await this.conversationOf(ctx, item, proposal)
        if (conversationId === null) return "auto"
        const target = await this.conversations.targetOf(conversationId)
        if (target.kind !== "ok" || target.value.connectionId === null) return "auto"
        const grants = await this.bindings.agentsFor(target.value.connectionId, PURPOSES)
        if (grants.length === 0) return "auto"
        const own = await this.agents.agentOfDepartment(ctx.workspaceId, item.department, item.installation_id)
        const mine = own === null ? undefined : grants.find((grant) => grant.id === own.id)
        return mine?.access ?? strongest(grants)
    }

    private async conversationOf(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<string | null> {
        const named = textOf(proposal.fields.conversation_id)
        if (named !== "") return named
        if (item.subject_type === "conversation" && item.subject_id !== null) return item.subject_id
        if (item.lead_id === null) return null
        return (await this.conversations.latestOfLead(ctx.workspaceId, item.lead_id, null))?.id ?? null
    }
}
