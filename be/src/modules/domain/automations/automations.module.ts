import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AutomationBusinessEventsService } from "./automation-business-events.service"
import { AutomationCareExecutorsService } from "./automation-care-executors.service"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationExtensionsService } from "./automation-extensions.service"
import { AutomationMessagesService } from "./automation-messages.service"
import { AutomationOperationsExecutorsService } from "./automation-operations-executors.service"
import { AutomationScansService } from "./automation-scans.service"
import { AutomationShopService } from "./automation-shop.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./automations.module-definition"
import { AutomationsService } from "./automations.service"
import { AutomationTickService } from "./automation-tick.service"
import { BusinessEventsService } from "./business-events.service"

@Module({})
/**
 * The automations capability over the primary Supabase PostgreSQL connection: the gallery and its pipelines, the run history and the
 * engine that runs them. Other capabilities plug executors, scans and ticks in through `AutomationExtensions`.
 */
export class AutomationsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                AutomationShopService,
                AutomationBusinessEventsService,
                AutomationScansService,
                AutomationExtensionsService,
                AutomationMessagesService,
                AutomationCareExecutorsService,
                AutomationOperationsExecutorsService,
                AutomationEngineService,
                AutomationsService,
                AutomationTickService,
                BusinessEventsService,
            ],
            exports: [
                AutomationBusinessEventsService,
                AutomationsService,
                AutomationEngineService,
                AutomationExtensionsService,
                AutomationTickService,
                BusinessEventsService,
            ],
        }
    }
}
