import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SendAgentChatMessageCommand } from "../../application/send-agent-chat-message.command"
import { toSendAgentChatMessageRequest, toSendAgentChatMessageType } from "./send-agent-chat-message.mapper"
import { SendAgentChatMessageInput } from "./dto/send-agent-chat-message.input"
import { QueuedAgentChatTurnType } from "./dto/queued-agent-chat-turn.type"

@Resolver()
/** The GraphQL door for sendAgentChatMessage. */
export class SendAgentChatMessageResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs sendAgentChatMessage under the verified caller. */
    @Mutation(() => QueuedAgentChatTurnType, { name: "sendAgentChatMessage" })
    async sendAgentChatMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SendAgentChatMessageInput,
    ): Promise<QueuedAgentChatTurnType> {
        const result = await this.commandBus.execute(
            new SendAgentChatMessageCommand({ request: toSendAgentChatMessageRequest(workspaceId, input), principal }),
        )
        return toSendAgentChatMessageType(result)
    }
}
