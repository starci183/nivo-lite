import { Injectable } from "@nestjs/common"
import { TOOL } from "@nivo-lite/blocks-core"
import { AgentsService } from "@modules/domain/agents"
import { ChatConversationsService } from "@modules/domain/chat-records"
import type { OutboundAccess, OutboundAccessGate, Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { ProviderAbilitiesService, providerOfChannel } from "@modules/domain/mcp-gateway"
import { conversationIdOf } from "./performer.policy"

@Injectable()
/**
 * How far the item's department agent may act on the account the message would leave through (the conversation named in the proposal,
 * else the one the item is about), read from the one rights model: the agent's attachment to that account and its `customer.send`
 * tick. "auto" when there is no conversation, no connection or no provider (website chat); "ask" when the department has no agent, or
 * its attachment asks for approval or holds no such right.
 */
export class OutboundAccessService implements OutboundAccessGate {
    constructor(
        private readonly conversations: ChatConversationsService,
        private readonly agents: AgentsService,
        private readonly abilities: ProviderAbilitiesService,
    ) {}

    /** What the item's department agent's attachment allows for a send on the connection of the conversation the message answers in. */
    async accessOf(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<OutboundAccess> {
        const conversationId = conversationIdOf(item, proposal.fields)
        if (conversationId === null) return "auto"
        const target = await this.conversations.targetOf(ctx.workspaceId, conversationId)
        if (target.kind !== "ok" || target.value.connectionId === null) return "auto"
        const own = await this.agents.agentOfDepartment(ctx.workspaceId, item.department, item.installation_id)
        if (own === null) return "ask"
        const verdict = await this.abilities.judge(ctx.workspaceId, own.id, TOOL.customerMessageSend, false, {
            provider: providerOfChannel(target.value.channel) ?? undefined,
            connectionId: target.value.connectionId,
        })
        if (verdict === null) return "auto"
        return verdict.kind === "allow" ? "auto" : "ask"
    }
}
