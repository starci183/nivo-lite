import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./conversations.module-definition"
import { ConversationsService } from "./conversations.service"
import { CustomerHearingService } from "./customer-hearing.service"
import { CustomerIntakeService } from "./customer-intake.service"

@Module({})
/** Channel intake into stored conversations: what a customer said is kept, and its agent is woken. A workflow answers it. */
export class ConversationsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ConversationsService,
                CustomerHearingService,
                CustomerIntakeService,
            ],
            exports: [ConversationsService, CustomerIntakeService],
        }
    }
}
