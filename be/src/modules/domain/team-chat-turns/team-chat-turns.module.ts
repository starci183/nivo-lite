import { Module, type DynamicModule } from "@nestjs/common"
import { ChatFallbackService } from "./chat-fallback.service"
import { ChatTurnLimiterService } from "./chat-turn-limiter.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./team-chat-turns.module-definition"
import { TeamChatTurnsService } from "./team-chat-turns.service"

@Module({})
/** The team chat turn: a person of the shop talks to an agent in /chat and the agent answers (the common-room rule). */
export class TeamChatTurnsModule extends ConfigurableModuleClass {
    /** Registers the capability once, in the app that hosts the team chat (the api). */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ChatTurnLimiterService, ChatFallbackService, TeamChatTurnsService],
            exports: [TeamChatTurnsService],
        }
    }
}
