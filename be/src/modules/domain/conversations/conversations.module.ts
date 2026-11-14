import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./conversations.module-definition"
import { HeldLinesService } from "./held-lines.service"

@Module({})
/** The hand-back of a held conversation (the release door): one event of the route's channel verb through the one delivery function. */
export class ConversationsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                HeldLinesService,
            ],
            exports: [HeldLinesService],
        }
    }
}
