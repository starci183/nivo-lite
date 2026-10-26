import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./chat-activity-sse.module-definition"
import { ChatActivityController } from "./chat-activity.controller"

@Module({ controllers: [ChatActivityController] })
/** The server-sent-events transport of the chat-activity channel: one authenticated stream per member and workspace. */
export class ChatActivitySseModule extends ConfigurableModuleClass {}
