import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AddChatRoomMemberCommand } from "../../application/add-chat-room-member.command"
import { ChatMessagesQuery } from "../../application/chat-messages.query"
import { ChatRoomQuery } from "../../application/chat-room.query"
import { ChatRoomsQuery } from "../../application/chat-rooms.query"
import { ChatUnreadQuery } from "../../application/chat-unread.query"
import { DecideChatApprovalCommand } from "../../application/decide-chat-approval.command"
import { CreateChatRoomCommand } from "../../application/create-chat-room.command"
import { MarkChatRoomReadCommand } from "../../application/mark-chat-room-read.command"
import { PinChatMessageCommand } from "../../application/pin-chat-message.command"
import { RemoveChatRoomMemberCommand } from "../../application/remove-chat-room-member.command"
import { RequestChatFileUploadCommand } from "../../application/request-chat-file-upload.command"
import { SetChatRoomMutedCommand } from "../../application/set-chat-room-muted.command"
import { SendChatMessageCommand } from "../../application/send-chat-message.command"
import { UnpinChatMessageCommand } from "../../application/unpin-chat-message.command"
import { ChatDecisionPayloadType } from "./dto/chat-decision-payload.type"
import { ChatFileUploadPayloadType } from "./dto/chat-file-upload-payload.type"
import { ChatMessagePageType } from "./dto/chat-message-page.type"
import { ChatMessagePayloadType } from "./dto/chat-message-payload.type"
import { ChatMessagesInput } from "./dto/chat-messages.input"
import { ChatPinInput } from "./dto/chat-pin.input"
import { ChatReadPayloadType } from "./dto/chat-read-payload.type"
import { ChatRoomInput } from "./dto/chat-room.input"
import { ChatRoomMemberInput } from "./dto/chat-room-member.input"
import { ChatRoomPayloadType } from "./dto/chat-room-payload.type"
import { ChatRoomType } from "./dto/chat-room.type"
import { ChatRoomsInput } from "./dto/chat-rooms.input"
import { ChatUnreadType } from "./dto/chat-unread.type"
import { CreateChatRoomInput } from "./dto/create-chat-room.input"
import { DecideChatApprovalInput } from "./dto/decide-chat-approval.input"
import { MarkChatRoomReadInput } from "./dto/mark-chat-room-read.input"
import { RequestChatFileUploadInput } from "./dto/request-chat-file-upload.input"
import { SendChatMessageInput } from "./dto/send-chat-message.input"
import { SetChatRoomMutedInput } from "./dto/set-chat-room-muted.input"
import {
    createRoomRequestOf,
    decideRequestOf,
    decisionPayloadOf,
    messagePageWireOf,
    messagePayloadOf,
    messagesRequestOf,
    readPayloadOf,
    roomMemberRequestOf,
    roomOrNullWireOf,
    roomPayloadOf,
    roomsRequestOf,
    roomsWireOf,
    sendRequestOf,
    uploadPayloadOf,
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
        return roomsWireOf(
            await this.queryBus.execute(new ChatRoomsQuery({ request: roomsRequestOf(workspaceId, input), principal })),
        )
    }

    /** One room; null when it is absent or the caller may not see it. */
    @Query(() => ChatRoomType, { name: "chatRoom", nullable: true })
    async chatRoom(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatRoomInput,
    ): Promise<ChatRoomType | null> {
        return roomOrNullWireOf(
            await this.queryBus.execute(
                new ChatRoomQuery({ request: { workspaceId, roomId: input.roomId }, principal }),
            ),
        )
    }

    /** One page of a thread, newest first. */
    @Query(() => ChatMessagePageType, { name: "chatMessages" })
    async chatMessages(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatMessagesInput,
    ): Promise<ChatMessagePageType> {
        return messagePageWireOf(
            await this.queryBus.execute(
                new ChatMessagesQuery({ request: messagesRequestOf(workspaceId, input), principal }),
            ),
        )
    }

    /** What the caller has not read, by room. */
    @Query(() => ChatUnreadType, { name: "chatUnread" })
    chatUnread(@CurrentPrincipal() principal: Principal, @WorkspaceId() workspaceId: string): Promise<ChatUnreadType> {
        return this.queryBus.execute(new ChatUnreadQuery({ request: { workspaceId }, principal }))
    }

    /** Opens a direct room or a group; a pair that already has a direct room gets that one. */
    @Mutation(() => ChatRoomPayloadType, { name: "createChatRoom" })
    async createChatRoom(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateChatRoomInput,
    ): Promise<ChatRoomPayloadType> {
        return roomPayloadOf(
            await this.commandBus.execute(
                new CreateChatRoomCommand({ request: createRoomRequestOf(workspaceId, input), principal }),
            ),
        )
    }

    /** Adds a person or an agent to a group. */
    @Mutation(() => ChatRoomPayloadType, { name: "addChatRoomMember" })
    async addChatRoomMember(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatRoomMemberInput,
    ): Promise<ChatRoomPayloadType> {
        return roomPayloadOf(
            await this.commandBus.execute(
                new AddChatRoomMemberCommand({ request: roomMemberRequestOf(workspaceId, input), principal }),
            ),
        )
    }

    /** Removes a member from a group; a member may remove themselves. */
    @Mutation(() => ChatRoomPayloadType, { name: "removeChatRoomMember" })
    async removeChatRoomMember(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatRoomMemberInput,
    ): Promise<ChatRoomPayloadType> {
        return roomPayloadOf(
            await this.commandBus.execute(
                new RemoveChatRoomMemberCommand({ request: roomMemberRequestOf(workspaceId, input), principal }),
            ),
        )
    }

    /** Writes a text message; an `@agent` mention starts a run through the tag trigger. */
    @Mutation(() => ChatMessagePayloadType, { name: "sendChatMessage" })
    async sendChatMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SendChatMessageInput,
    ): Promise<ChatMessagePayloadType> {
        return messagePayloadOf(
            await this.commandBus.execute(
                new SendChatMessageCommand({ request: sendRequestOf(workspaceId, input), principal }),
            ),
        )
    }

    /** Moves the caller read position. */
    @Mutation(() => ChatReadPayloadType, { name: "markChatRoomRead" })
    async markChatRoomRead(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: MarkChatRoomReadInput,
    ): Promise<ChatReadPayloadType> {
        return readPayloadOf(
            await this.commandBus.execute(
                new MarkChatRoomReadCommand({
                    request: { workspaceId, roomId: input.roomId, messageId: input.messageId },
                    principal,
                }),
            ),
        )
    }

    /** Answers the decision an approval card is about; every card of that decision then shows the outcome. */
    @Mutation(() => ChatDecisionPayloadType, { name: "decideChatApproval" })
    async decideChatApproval(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DecideChatApprovalInput,
    ): Promise<ChatDecisionPayloadType> {
        return decisionPayloadOf(
            await this.commandBus.execute(
                new DecideChatApprovalCommand({ request: decideRequestOf(workspaceId, input), principal }),
            ),
        )
    }

    /** Issues the address a browser uploads one file of a room to. */
    @Mutation(() => ChatFileUploadPayloadType, { name: "requestChatFileUpload" })
    async requestChatFileUpload(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestChatFileUploadInput,
    ): Promise<ChatFileUploadPayloadType> {
        return uploadPayloadOf(
            await this.commandBus.execute(
                new RequestChatFileUploadCommand({
                    request: {
                        workspaceId,
                        roomId: input.roomId,
                        fileName: input.fileName,
                        mimeType: input.mimeType,
                        sizeBytes: input.sizeBytes,
                    },
                    principal,
                }),
            ),
        )
    }

    /** Mutes or unmutes a room for the caller. */
    @Mutation(() => ChatRoomPayloadType, { name: "setChatRoomMuted" })
    async setChatRoomMuted(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetChatRoomMutedInput,
    ): Promise<ChatRoomPayloadType> {
        return roomPayloadOf(
            await this.commandBus.execute(
                new SetChatRoomMutedCommand({
                    request: { workspaceId, roomId: input.roomId, muted: input.muted },
                    principal,
                }),
            ),
        )
    }

    /** Pins a message. */
    @Mutation(() => ChatMessagePayloadType, { name: "pinChatMessage" })
    async pinChatMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatPinInput,
    ): Promise<ChatMessagePayloadType> {
        return messagePayloadOf(
            await this.commandBus.execute(
                new PinChatMessageCommand({
                    request: { workspaceId, roomId: input.roomId, messageId: input.messageId },
                    principal,
                }),
            ),
        )
    }

    /** Takes a pin off. */
    @Mutation(() => ChatMessagePayloadType, { name: "unpinChatMessage" })
    async unpinChatMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChatPinInput,
    ): Promise<ChatMessagePayloadType> {
        return messagePayloadOf(
            await this.commandBus.execute(
                new UnpinChatMessageCommand({
                    request: { workspaceId, roomId: input.roomId, messageId: input.messageId },
                    principal,
                }),
            ),
        )
    }
}
