import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ChatMarkerStateQuery } from "../../application/chat-marker-state.query"
import { MarkChatDeliveredCommand } from "../../application/mark-chat-delivered.command"
import { MarkChatReadCommand } from "../../application/mark-chat-read.command"
import { SetChatMutedCommand } from "../../application/set-chat-muted.command"
import {
    toChatMarkerAckType,
    toChatMarkerRequest,
    toChatMuteRequest,
    toChatReceiptRequest,
} from "./chat-markers.mapper"
import { ChatMarkerAckType } from "./dto/chat-marker-ack.type"
import { ChatMarkerStateType } from "./dto/chat-marker-state.type"
import { ChatMuteInput } from "./dto/chat-mute.input"
import { ChatReceiptInput } from "./dto/chat-receipt.input"
import { ChatTargetInput } from "./dto/chat-target.input"

@Resolver()
/** GraphQL doors for current-member chat receipt and notification state. */
export class ChatMarkersResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Reads the current member's preference and last authored message status. */
    @Query(() => ChatMarkerStateType, { name: "chatMarkerState" })
    async chatMarkerState(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatTargetInput,
    ): Promise<ChatMarkerStateType> {
        const result = await this.queryBus.execute(
            new ChatMarkerStateQuery({ request: toChatMarkerRequest(workspaceId, input), principal }),
        )
        return result
    }

    /** Called only after the member's client fetched messages through the supplied message. */
    @Mutation(() => ChatMarkerAckType, { name: "markChatDelivered" })
    async markChatDelivered(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatReceiptInput,
    ): Promise<ChatMarkerAckType> {
        await this.commandBus.execute(
            new MarkChatDeliveredCommand({ request: toChatReceiptRequest(workspaceId, input), principal }),
        )
        return toChatMarkerAckType()
    }

    /** Called only after the member visibly read messages through the supplied message. */
    @Mutation(() => ChatMarkerAckType, { name: "markChatRead" })
    async markChatRead(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatReceiptInput,
    ): Promise<ChatMarkerAckType> {
        await this.commandBus.execute(
            new MarkChatReadCommand({ request: toChatReceiptRequest(workspaceId, input), principal }),
        )
        return toChatMarkerAckType()
    }

    /** Sets the current member's mute preference for this chat. */
    @Mutation(() => ChatMarkerAckType, { name: "setChatMuted" })
    async setChatMuted(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatMuteInput,
    ): Promise<ChatMarkerAckType> {
        await this.commandBus.execute(
            new SetChatMutedCommand({ request: toChatMuteRequest(workspaceId, input), principal }),
        )
        return toChatMarkerAckType()
    }
}
