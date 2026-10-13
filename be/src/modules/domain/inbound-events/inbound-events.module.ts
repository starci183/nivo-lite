import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inbound-events.module-definition"
import { InboundEventsService } from "./inbound-events.service"

@Module({})
/** The inputs a workspace received, over the primary Supabase PostgreSQL connection. */
export class InboundEventsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), InboundEventsService],
            exports: [InboundEventsService],
        }
    }
}
