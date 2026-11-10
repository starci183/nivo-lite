import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ForwardChatMessageCommand } from "../../application/forward-chat-message.command"
import { ReactChatMessageCommand } from "../../application/react-chat-message.command"
import { ChatForwardInput } from "./dto/chat-forward.input"
import { ChatMessagePayloadType } from "./dto/chat-message-payload.type"
import { ChatReactInput } from "./dto/chat-react.input"
import { messagePayloadOf } from "./team-chat.mapper"

@Resolver()
/** GraphQL doors of the reactions and the forwards of the internal team chat. */
export class TeamChatReactionsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Adds taps of one emoji to a message; only a member of its room reacts. A burst of taps is one call with `times`. */
    @Mutation(() => ChatMessagePayloadType, { name: "reactToChatMessage" })
    async reactToChatMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatReactInput,
    ): Promise<ChatMessagePayloadType> {
        return messagePayloadOf(
            await this.commandBus.execute(
                new ReactChatMessageCommand({
                    request: { workspaceId, messageId: input.messageId, emoji: input.emoji, times: input.times },
                    principal,
                }),
            ),
        )
    }

    /** Forwards a message (its text and its agent card) into another room the caller sits in. */
    @Mutation(() => ChatMessagePayloadType, { name: "forwardChatMessage" })
    async forwardChatMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatForwardInput,
    ): Promise<ChatMessagePayloadType> {
        return messagePayloadOf(
            await this.commandBus.execute(
                new ForwardChatMessageCommand({
                    request: { workspaceId, messageId: input.messageId, roomId: input.roomId },
                    principal,
                }),
            ),
        )
    }
}
