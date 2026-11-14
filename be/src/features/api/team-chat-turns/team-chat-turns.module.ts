import { Module } from "@nestjs/common"
import { CaptureChatTruthHandler } from "./application/capture-chat-truth.handler"
import { ConfigurableModuleClass } from "./team-chat-turns.module-definition"

@Module({
    providers: [CaptureChatTruthHandler],
})
/** The "Ghi vao Second Brain" door of the team chat: the handler of its application. */
export class TeamChatTurnsApiModule extends ConfigurableModuleClass {}
