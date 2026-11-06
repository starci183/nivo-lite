import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AddChatRoomMemberCommand } from "../../application/add-chat-room-member.command"
import { ChatMessagesQuery } from "../../application/chat-messages.query"
import { ChatRoomQuery } from "../../application/chat-room.query"
import { ChatRoomsQuery } from "../../application/chat-rooms.query"
import { ChatUnreadQuery } from "../../application/chat-unread.query"
import { CreateChatRoomCommand } from "../../application/create-chat-room.command"
import { MarkChatRoomReadCommand } from "../../application/mark-chat-room-read.command"
import { PinChatMessageCommand } from "../../application/pin-chat-message.command"
import { RemoveChatRoomMemberCommand } from "../../application/remove-chat-room-member.command"
import { SendChatMessageCommand } from "../../application/send-chat-message.command"
import { UnpinChatMessageCommand } from "../../application/unpin-chat-message.command"
import { ChatMessagePageType } from "./dto/chat-message-page.type"
import { ChatMessagePayloadType } from "./dto/chat-message-payload.type"
import { ChatMessagesInput } from "./dto/chat-messages.input"
import { ChatPinInput } from "./dto/chat-pin.input"
import { ChatReadPayloadType } from "./dto/chat-read-payload.type"
import { ChatRoomMemberInput } from "./dto/chat-room-member.input"
import { ChatRoomPayloadType } from "./dto/chat-room-payload.type"
import { ChatRoomType } from "./dto/chat-room.type"
import { ChatRoomsInput } from "./dto/chat-rooms.input"
import { ChatUnreadType } from "./dto/chat-unread.type"
import { CreateChatRoomInput } from "./dto/create-chat-room.input"
import { MarkChatRoomReadInput } from "./dto/mark-chat-room-read.input"
import { SendChatMessageInput } from "./dto/send-chat-message.input"
import {
    toChatMessagePageType,
    toChatRoomType,
    toChatUnreadType,
    toMemberRef,
    toMessagePayload,
    toReadPayload,
    toRoomPayload,
} from "./team-chat.mapper"

@Resolver()
/** GraphQL doors of the internal team chat: rooms, members, messages, pins and read positions. */
export class TeamChatResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** The rooms the caller sits in; an owner of the workspace sees all of them. */
    @Query(() => [ChatRoomType], { name: "chatRooms" })
    async chatRooms(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input", { nullable: true }) input?: ChatRoomsInput,
    ): Promise<Array<ChatRoomType>> {
        const kind = input?.kind === "direct" || input?.kind === "group" ? input.kind : null
        const rooms = await this.queryBus.execute(new ChatRoomsQuery({ request: { workspaceId, kind, member: input?.member ?? null }, principal }))
        return rooms.map(toChatRoomType)
    }

    /** One room; null when it is absent or the caller may not see it. */
    @Query(() => ChatRoomType, { name: "chatRoom", nullable: true })
    async chatRoom(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("id", { type: () => ID }) roomId: string,
    ): Promise<ChatRoomType | null> {
        const room = await this.queryBus.execute(new ChatRoomQuery({ request: { workspaceId, roomId }, principal }))
        return room === null ? null : toChatRoomType(room)
    }

    /** One page of a thread, newest first. */
    @Query(() => ChatMessagePageType, { name: "chatMessages" })
    async chatMessages(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatMessagesInput,
    ): Promise<ChatMessagePageType> {
        const request = {
            workspaceId,
            roomId: input.roomId,
            first: input.first,
            after: input.after,
            pinnedOnly: input.pinnedOnly === true,
        }
        return toChatMessagePageType(await this.queryBus.execute(new ChatMessagesQuery({ request, principal })))
    }

    /** What the caller has not read, by room. */
    @Query(() => ChatUnreadType, { name: "chatUnread" })
    async chatUnread(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ChatUnreadType> {
        return toChatUnreadType(
            await this.queryBus.execute(new ChatUnreadQuery({ request: { workspaceId }, principal })),
        )
    }

    /** Opens a direct room or a group; a pair that already has a direct room gets that one. */
    @Mutation(() => ChatRoomPayloadType, { name: "createChatRoom" })
    async createChatRoom(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateChatRoomInput,
    ): Promise<ChatRoomPayloadType> {
        const request = {
            workspaceId,
            kind: input.kind === "direct" ? ("direct" as const) : ("group" as const),
            name: input.name,
            members: input.members.map(toMemberRef),
        }
        return toRoomPayload(await this.commandBus.execute(new CreateChatRoomCommand({ request, principal })))
    }

    /** Adds a person or an agent to a group. */
    @Mutation(() => ChatRoomPayloadType, { name: "addChatRoomMember" })
    async addChatRoomMember(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatRoomMemberInput,
    ): Promise<ChatRoomPayloadType> {
        const request = { workspaceId, roomId: input.roomId, member: toMemberRef(input.member) }
        return toRoomPayload(await this.commandBus.execute(new AddChatRoomMemberCommand({ request, principal })))
    }

    /** Removes a member from a group; a member may remove themselves. */
    @Mutation(() => ChatRoomPayloadType, { name: "removeChatRoomMember" })
    async removeChatRoomMember(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatRoomMemberInput,
    ): Promise<ChatRoomPayloadType> {
        const request = { workspaceId, roomId: input.roomId, member: toMemberRef(input.member) }
        return toRoomPayload(await this.commandBus.execute(new RemoveChatRoomMemberCommand({ request, principal })))
    }

    /** Writes a text message; an `@agent` mention starts a run through the tag trigger. */
    @Mutation(() => ChatMessagePayloadType, { name: "sendChatMessage" })
    async sendChatMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SendChatMessageInput,
    ): Promise<ChatMessagePayloadType> {
        const request = {
            workspaceId,
            roomId: input.roomId,
            to: input.to === null ? null : toMemberRef(input.to),
            body: input.body,
            mentions: (input.mentions ?? []).map(toMemberRef),
            fileKeys: input.fileKeys ?? [],
            clientId: input.clientId,
        }
        return toMessagePayload(await this.commandBus.execute(new SendChatMessageCommand({ request, principal })))
    }

    /** Moves the caller read position. */
    @Mutation(() => ChatReadPayloadType, { name: "markChatRoomRead" })
    async markChatRoomRead(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: MarkChatRoomReadInput,
    ): Promise<ChatReadPayloadType> {
        const request = { workspaceId, roomId: input.roomId, messageId: input.messageId }
        return toReadPayload(await this.commandBus.execute(new MarkChatRoomReadCommand({ request, principal })))
    }

    /** Pins a message. */
    @Mutation(() => ChatMessagePayloadType, { name: "pinChatMessage" })
    async pinChatMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatPinInput,
    ): Promise<ChatMessagePayloadType> {
        const request = { workspaceId, roomId: input.roomId, messageId: input.messageId }
        return toMessagePayload(await this.commandBus.execute(new PinChatMessageCommand({ request, principal })))
    }

    /** Takes a pin off. */
    @Mutation(() => ChatMessagePayloadType, { name: "unpinChatMessage" })
    async unpinChatMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatPinInput,
    ): Promise<ChatMessagePayloadType> {
        const request = { workspaceId, roomId: input.roomId, messageId: input.messageId }
        return toMessagePayload(await this.commandBus.execute(new UnpinChatMessageCommand({ request, principal })))
    }
}
