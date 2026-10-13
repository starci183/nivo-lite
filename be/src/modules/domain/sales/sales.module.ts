import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DecisionsQueueModule } from "@modules/queues/decisions"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./sales.module-definition"
import { SalesDecisionsService } from "./sales-decisions.service"
import { SalesShipmentsService } from "./sales-shipments.service"
import { SalesStatusService } from "./sales-status.service"
import { SalesWorkService } from "./sales-work.service"

@Module({})
/** The Sales composer; the app provides every table-owning capability once. */
export class SalesModule extends ConfigurableModuleClass {
    /** Registers Sales with the app's global domain services. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), DecisionsQueueModule],
            providers: [
                ...(base.providers ?? []),
                SalesDecisionsService,
                SalesShipmentsService,
                SalesStatusService,
                SalesWorkService,
            ],
            exports: [SalesDecisionsService, SalesShipmentsService, SalesStatusService, SalesWorkService],
        }
    }
}
