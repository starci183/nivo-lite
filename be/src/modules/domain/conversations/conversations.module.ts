import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CHAT_TURN_EXTENSIONS, CHAT_TURN_OUTCOMES } from "./conversations.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./conversations.module-definition"
import { ChatTurnExtensionsService } from "./chat-turn-extensions.service"
import { ConversationsService } from "./conversations.service"
import { CustomerHearingService } from "./customer-hearing.service"
import { CustomerIntakeService } from "./customer-intake.service"
import { ChatTurnService } from "./chat-turn.service"

@Module({})
/** Channel intake into stored conversations and the answer to each customer turn. */
export class ConversationsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const plugged =
            options.outcomes === undefined ? [] : [{ provide: CHAT_TURN_OUTCOMES, useClass: options.outcomes }]
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ...plugged,
                ChatTurnExtensionsService,
                ConversationsService,
                CustomerHearingService,
                CustomerIntakeService,
                ChatTurnService,
                { provide: CHAT_TURN_EXTENSIONS, useExisting: ChatTurnExtensionsService },
            ],
            exports: [CHAT_TURN_EXTENSIONS, ConversationsService, CustomerIntakeService, ChatTurnService],
        }
    }
}
