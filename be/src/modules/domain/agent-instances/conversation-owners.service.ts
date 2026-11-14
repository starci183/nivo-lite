import { Injectable, Optional } from "@nestjs/common"
import { ChannelOwnersService } from "@modules/domain/agent-connections"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import type { OptionalOwnerAgentId } from "./agent-instances.contracts"

@Injectable()
/**
 * Which agent of a role answers the channel a conversation came in on (one role, many agents): the hand-off of a conversation to
 * "Sales" goes to the Sales agent that owns its channel, not to the oldest Sales agent of the workspace. It implements the conversation
 * channel owners port of the agents capability.
 */
export class ConversationOwnersService {
    constructor(
        private readonly owners: ChannelOwnersService,
        @Optional() private readonly routes?: CustomerRoutesService,
    ) {}

    /**
     * The agent of `module` that answers the conversation's channel; null when it came in on none, or no agent of the role answers it.
     * The id is a route (the engine's id of the person on the entrance, whose account is the connection); the engine reads no chatbot record.
     */
    async ownerAgentOf(workspaceId: string, conversationId: string, module: string): Promise<OptionalOwnerAgentId> {
        const connectionId = ((await this.routes?.get(workspaceId, conversationId)) ?? null)?.accountId ?? null
        if (connectionId === null) return null
        return (await this.owners.ownerOf(connectionId, module))?.agentId ?? null
    }
}
