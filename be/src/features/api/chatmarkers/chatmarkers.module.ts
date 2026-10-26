import { Module } from "@nestjs/common"
import { ChatMarkerStateHandler } from "./application/chat-marker-state.handler"
import { MarkChatDeliveredHandler } from "./application/mark-chat-delivered.handler"
import { MarkChatReadHandler } from "./application/mark-chat-read.handler"
import { SetChatMutedHandler } from "./application/set-chat-muted.handler"
import { ConfigurableModuleClass } from "./chatmarkers.module-definition"

@Module({
    providers: [ChatMarkerStateHandler, MarkChatDeliveredHandler, MarkChatReadHandler, SetChatMutedHandler],
})
/** Workspace-scoped chat receipts and per-member notification preferences. */
export class ChatMarkersApiModule extends ConfigurableModuleClass {}
