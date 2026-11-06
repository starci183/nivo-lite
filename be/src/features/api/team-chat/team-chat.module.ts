import { Module } from "@nestjs/common"
import { ChatRoomsHandler } from "./application/chat-rooms.handler"
import { ChatRoomHandler } from "./application/chat-room.handler"
import { ChatMessagesHandler } from "./application/chat-messages.handler"
import { ChatUnreadHandler } from "./application/chat-unread.handler"
import { CreateChatRoomHandler } from "./application/create-chat-room.handler"
import { RequestChatFileUploadHandler } from "./application/request-chat-file-upload.handler"
import { SetChatRoomMutedHandler } from "./application/set-chat-room-muted.handler"
import { AddChatRoomMemberHandler } from "./application/add-chat-room-member.handler"
import { RemoveChatRoomMemberHandler } from "./application/remove-chat-room-member.handler"
import { SendChatMessageHandler } from "./application/send-chat-message.handler"
import { MarkChatRoomReadHandler } from "./application/mark-chat-room-read.handler"
import { PinChatMessageHandler } from "./application/pin-chat-message.handler"
import { UnpinChatMessageHandler } from "./application/unpin-chat-message.handler"
import { ConfigurableModuleClass } from "./team-chat.module-definition"

@Module({
    providers: [
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
    ],
})
/** The workspace-scoped team chat: the handlers behind the rooms, messages, pins and read positions. */
export class TeamChatApiModule extends ConfigurableModuleClass {}
