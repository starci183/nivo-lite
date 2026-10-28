import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetChatTypingCommand } from "../../application/set-chat-typing.command"
import { toChatTypingSignalType, toSetChatTypingRequest } from "./chat-typing.mapper"
import { ChatTypingSignalType } from "./dto/chat-typing-signal.type"
import { SetChatTypingInput } from "./dto/set-chat-typing.input"

@Resolver()
/** The write path of typing hints; the push itself is the SSE door `realtime/chat-typing`, which only reads. */
export class ChatTypingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Emits a five-second typing hint or an immediate stop for the authenticated account. */
    @Mutation(() => ChatTypingSignalType, { name: "setChatTyping" })
    async setChatTyping(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetChatTypingInput,
    ): Promise<ChatTypingSignalType> {
        const signal = await this.commandBus.execute(
            new SetChatTypingCommand({ request: toSetChatTypingRequest(workspaceId, input), principal }),
        )
        return toChatTypingSignalType(signal)
    }
}
