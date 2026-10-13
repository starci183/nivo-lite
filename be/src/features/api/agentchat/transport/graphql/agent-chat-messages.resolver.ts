import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListAgentChatMessagesQuery } from "../../application/agent-chat-messages.query"
import { toListAgentChatMessagesRequest, toListAgentChatMessagesType } from "./agent-chat-messages.mapper"
import { AgentChatMessagesInput } from "./dto/agent-chat-messages.input"
import { AgentChatMessageType } from "./dto/agent-chat-message.type"

@Resolver()
/** The GraphQL door for agentChatMessages. */
export class ListAgentChatMessagesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Runs agentChatMessages under the verified caller. */
    @Query(() => [AgentChatMessageType], { name: "agentChatMessages" })
    async agentChatMessages(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentChatMessagesInput,
    ): Promise<Array<AgentChatMessageType>> {
        const result = await this.queryBus.execute(
            new ListAgentChatMessagesQuery({ request: toListAgentChatMessagesRequest(workspaceId, input), principal }),
        )
        return toListAgentChatMessagesType(result)
    }
}
