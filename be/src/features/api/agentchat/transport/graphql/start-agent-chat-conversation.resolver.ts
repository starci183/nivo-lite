import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { StartAgentChatConversationCommand } from "../../application/start-agent-chat-conversation.command"
import {
    toStartAgentChatConversationRequest,
    toStartAgentChatConversationType,
} from "./start-agent-chat-conversation.mapper"
import { StartAgentChatConversationInput } from "./dto/start-agent-chat-conversation.input"
import { CreatedAgentChatConversationType } from "./dto/created-agent-chat-conversation.type"

@Resolver()
/** The GraphQL door for startAgentChatConversation. */
export class StartAgentChatConversationResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs startAgentChatConversation under the verified caller. */
    @Mutation(() => CreatedAgentChatConversationType, { name: "startAgentChatConversation" })
    async startAgentChatConversation(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: StartAgentChatConversationInput,
    ): Promise<CreatedAgentChatConversationType> {
        const result = await this.commandBus.execute(
            new StartAgentChatConversationCommand({
                request: toStartAgentChatConversationRequest(workspaceId, input),
                principal,
            }),
        )
        return toStartAgentChatConversationType(result)
    }
}
