import { Module } from "@nestjs/common"
import { ChatApprovalDecisionService } from "@modules/domain/agent-pages"
import { ChatRoomsHandler } from "./application/chat-rooms.handler"
import { ChatRoomHandler } from "./application/chat-room.handler"
import { ChatMessagesHandler } from "./application/chat-messages.handler"
import { ChatUnreadHandler } from "./application/chat-unread.handler"
import { CreateChatRoomHandler } from "./application/create-chat-room.handler"
import { RequestChatFileUploadHandler } from "./application/request-chat-file-upload.handler"
import { SetChatRoomMutedHandler } from "./application/set-chat-room-muted.handler"
import { DecideChatApprovalHandler } from "./application/decide-chat-approval.handler"
import { AddChatRoomMemberHandler } from "./application/add-chat-room-member.handler"
import { RemoveChatRoomMemberHandler } from "./application/remove-chat-room-member.handler"
import { SendChatMessageHandler } from "./application/send-chat-message.handler"
import { MarkChatRoomReadHandler } from "./application/mark-chat-room-read.handler"
import { PinChatMessageHandler } from "./application/pin-chat-message.handler"
import { UnpinChatMessageHandler } from "./application/unpin-chat-message.handler"
import { ReactChatMessageHandler } from "./application/react-chat-message.handler"
import { ForwardChatMessageHandler } from "./application/forward-chat-message.handler"
import { SetChatRoomPurposeHandler } from "./application/set-chat-room-purpose.handler"
import { SetChatRoomPostRightHandler } from "./application/set-chat-room-post-right.handler"
import { ConfigurableModuleClass } from "./team-chat.module-definition"

@Module({
    providers: [
        ChatApprovalDecisionService,
        DecideChatApprovalHandler,
        RequestChatFileUploadHandler,
        SetChatRoomMutedHandler,
        ChatRoomsHandler,
        ChatRoomHandler,
        ChatMessagesHandler,
        ChatUnreadHandler,
        CreateChatRoomHandler,
        AddChatRoomMemberHandler,
        RemoveChatRoomMemberHandler,
        SendChatMessageHandler,
        MarkChatRoomReadHandler,
        PinChatMessageHandler,
        UnpinChatMessageHandler,
        ReactChatMessageHandler,
        ForwardChatMessageHandler,
        SetChatRoomPurposeHandler,
        SetChatRoomPostRightHandler,
    ],
})
/** The workspace-scoped team chat: the handlers behind the rooms, messages, pins and read positions. */
export class TeamChatApiModule extends ConfigurableModuleClass {}
