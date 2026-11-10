import { Injectable } from "@nestjs/common"
import { ChannelOwnersService } from "@modules/domain/agent-connections"
import { ChatConversationsService } from "@modules/domain/chat-records"
import type { OptionalOwnerAgentId } from "./agent-instances.contracts"

@Injectable()
/**
 * Which agent of a role answers the channel a conversation came in on (one role, many agents): the hand-off of a conversation to
 * "Sales" goes to the Sales agent that owns its channel, not to the oldest Sales agent of the workspace. It implements the conversation
 * channel owners port of the agents capability.
 */
export class ConversationOwnersService {
    constructor(
        private readonly conversations: ChatConversationsService,
        private readonly owners: ChannelOwnersService,
    ) {}

    /** The agent of `module` that answers the conversation's channel; null when it came in on none, or no agent of the role answers it. */
    async ownerAgentOf(workspaceId: string, conversationId: string, module: string): Promise<OptionalOwnerAgentId> {
        const conversation = await this.conversations.humanOf(workspaceId, conversationId)
        const connectionId = conversation?.connectionId ?? null
        if (connectionId === null) return null
        return (await this.owners.ownerOf(connectionId, module))?.agentId ?? null
    }

    /** The agent of `module` that answers the channel of the customer's newest conversation that has a connection; null when none does. */
    async ownerAgentOfLead(workspaceId: string, leadId: string, module: string): Promise<OptionalOwnerAgentId> {
        const conversations = await this.conversations.ofLeads(workspaceId, [leadId])
        const connectionId = conversations.find((each) => each.connectionId !== null)?.connectionId ?? null
        if (connectionId === null) return null
        return (await this.owners.ownerOf(connectionId, module))?.agentId ?? null
    }
}
