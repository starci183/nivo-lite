import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { EventsService } from "./events.service"
import { EventsActivityReadService } from "./events-activity-read.service"
import { EventsReadService } from "./events-read.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./events.module-definition"

@Module({})
/** The evidence log of a workspace over the primary PostgreSQL connection. */
export class EventsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), EventsService, EventsReadService, EventsActivityReadService],
            exports: [EventsService, EventsReadService, EventsActivityReadService],
        }
    }
}
