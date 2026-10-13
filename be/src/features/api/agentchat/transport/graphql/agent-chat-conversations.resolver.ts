import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListAgentChatConversationsQuery } from "../../application/agent-chat-conversations.query"
import {
    toListAgentChatConversationsRequest,
    toListAgentChatConversationsType,
} from "./agent-chat-conversations.mapper"
import { AgentChatConversationsInput } from "./dto/agent-chat-conversations.input"
import { AgentChatConversationType } from "./dto/agent-chat-conversation.type"

@Resolver()
/** The GraphQL door for agentChatConversations. */
export class ListAgentChatConversationsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Runs agentChatConversations under the verified caller. */
    @Query(() => [AgentChatConversationType], { name: "agentChatConversations" })
    async agentChatConversations(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentChatConversationsInput,
    ): Promise<Array<AgentChatConversationType>> {
        const result = await this.queryBus.execute(
            new ListAgentChatConversationsQuery({
                request: toListAgentChatConversationsRequest(workspaceId, input),
                principal,
            }),
        )
        return toListAgentChatConversationsType(result)
    }
}
