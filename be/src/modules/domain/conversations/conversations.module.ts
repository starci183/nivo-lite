import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChatTurnModule } from "@modules/queues/chat-turn"
import { CHAT_TURN_EXTENSIONS, CHAT_TURN_OUTCOMES, CHAT_TURN_RUNTIME } from "./conversations.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./conversations.module-definition"
import { ChatTurnExtensionsService } from "./chat-turn-extensions.service"
import { ConversationsService } from "./conversations.service"
import { ChatTurnService } from "./chat-turn.service"

@Module({})
/** Channel intake into stored conversations and the answer to each customer turn. */
export class ConversationsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const plugged = [
            ...(options.runtime === undefined ? [] : [{ provide: CHAT_TURN_RUNTIME, useClass: options.runtime }]),
            ...(options.outcomes === undefined ? [] : [{ provide: CHAT_TURN_OUTCOMES, useClass: options.outcomes }]),
        ]
        return {
            ...base,
            imports: [...(base.imports ?? []), ChatTurnModule.register({})],
            providers: [
                ...(base.providers ?? []),
                ...plugged,
                ChatTurnExtensionsService,
                ConversationsService,
                ChatTurnService,
                { provide: CHAT_TURN_EXTENSIONS, useExisting: ChatTurnExtensionsService },
            ],
            exports: [CHAT_TURN_EXTENSIONS, ConversationsService, ChatTurnService, ChatTurnModule],
        }
    }
}
