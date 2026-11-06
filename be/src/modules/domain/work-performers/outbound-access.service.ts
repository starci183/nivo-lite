import { Injectable } from "@nestjs/common"
import { AgentBindingsService, PURPOSES } from "@modules/domain/agent-connections"
import type { BoundAgent } from "@modules/domain/agent-connections"
import { AgentsService } from "@modules/domain/agents"
import { ChatConversationsService } from "@modules/domain/chat-records"
import type { OutboundAccess, OutboundAccessGate, Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { conversationIdOf } from "./performer.policy"

const RANK: Readonly<Record<OutboundAccess, number>> = { read: 0, ask: 1, auto: 2 }

/** The access of the agent that owns the connection, or the strongest grant of it when the department's own agent is not bound. */
const strongest = (grants: ReadonlyArray<BoundAgent>): OutboundAccess =>
    grants.reduce<OutboundAccess>((best, grant) => (RANK[grant.access] > RANK[best] ? grant.access : best), "read")

@Injectable()
/**
 * How far the item's department agent may act on the connection the message would leave through: the conversation named in the proposal,
 * else the one the item is about. "auto" when there is no conversation, no connection (website chat) or nothing is bound.
 */
export class OutboundAccessService implements OutboundAccessGate {
    constructor(
        private readonly conversations: ChatConversationsService,
        private readonly bindings: AgentBindingsService,
        private readonly agents: AgentsService,
    ) {}

    /** The access the item's department agent has on the connection of the conversation the message answers in. */
    async accessOf(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<OutboundAccess> {
        const conversationId = conversationIdOf(item, proposal.fields)
        if (conversationId === null) return "auto"
        const target = await this.conversations.targetOf(ctx.workspaceId, conversationId)
        if (target.kind !== "ok" || target.value.connectionId === null) return "auto"
        const grants = await this.bindings.agentsFor(target.value.connectionId, PURPOSES)
        if (grants.length === 0) return "auto"
        const own = await this.agents.agentOfDepartment(ctx.workspaceId, item.department, item.installation_id)
        const mine = own === null ? undefined : grants.find((grant) => grant.id === own.id)
        return mine?.access ?? strongest(grants)
    }
}
