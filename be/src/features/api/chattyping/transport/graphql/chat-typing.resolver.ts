import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ChatTypingChannelQuery } from "../../application/chat-typing-channel.query"
import { SetChatTypingCommand } from "../../application/set-chat-typing.command"
import {
    toChatTypingChannelType,
    toChatTypingRequest,
    toChatTypingSignalType,
    toSetChatTypingRequest,
} from "./chat-typing.mapper"
import { ChatTypingChannelType } from "./dto/chat-typing-channel.type"
import { ChatTypingSignalType } from "./dto/chat-typing-signal.type"
import { ChatTypingTargetInput } from "./dto/chat-typing-target.input"
import { SetChatTypingInput } from "./dto/set-chat-typing.input"

@Resolver()
/** Authenticated channel discovery and server-authored typing broadcasts. */
export class ChatTypingResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Joins are receive-only and private; membership is checked again by Supabase Realtime RLS. */
    @Query(() => ChatTypingChannelType, { name: "chatTypingChannel" })
    async chatTypingChannel(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatTypingTargetInput,
    ): Promise<ChatTypingChannelType> {
        const channel = await this.queryBus.execute(
            new ChatTypingChannelQuery({ request: toChatTypingRequest(workspaceId, input), principal }),
        )
        return toChatTypingChannelType(channel)
    }

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
