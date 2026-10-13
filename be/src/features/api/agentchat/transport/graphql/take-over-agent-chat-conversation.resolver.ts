import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { TakeOverAgentChatConversationCommand } from "../../application/take-over-agent-chat-conversation.command"
import {
    toTakeOverAgentChatConversationRequest,
    toTakeOverAgentChatConversationType,
} from "./take-over-agent-chat-conversation.mapper"
import { TakeOverAgentChatConversationInput } from "./dto/take-over-agent-chat-conversation.input"
import { AgentChatHolderType } from "./dto/agent-chat-holder.type"

@Resolver()
/** The GraphQL door for takeOverAgentChatConversation. */
export class TakeOverAgentChatConversationResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs takeOverAgentChatConversation under the verified caller. */
    @Mutation(() => AgentChatHolderType, { name: "takeOverAgentChatConversation" })
    async takeOverAgentChatConversation(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: TakeOverAgentChatConversationInput,
    ): Promise<AgentChatHolderType> {
        const result = await this.commandBus.execute(
            new TakeOverAgentChatConversationCommand({
                request: toTakeOverAgentChatConversationRequest(workspaceId, input),
                principal,
            }),
        )
        return toTakeOverAgentChatConversationType(result)
    }
}
