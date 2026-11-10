import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LeadFreezeAnswersService } from "./lead-freeze-answers.service"
import { LeadFreezeDoorService } from "./lead-freeze-door.service"
import { LeadFreezeItemsService } from "./lead-freeze-items.service"
import { LeadFreezePerformerService } from "./lead-freeze-performer.service"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import { LeadFreezeRunsService } from "./lead-freeze-runs.service"
import { LeadFreezeWakesService } from "./lead-freeze-wakes.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./lead-freezes.module-definition"
import { LeadFreezesService } from "./lead-freezes.service"

@Module({})
/**
 * The freeze of a customer whose run failed for good: no new run starts for them until the owner retries the run or skips the turn. It
 * registers with the gate of the graph flows and with the work engine's performers when it starts, so neither holds it in a constructor.
 * It needs the run engine, the graph flows, the work engine, the wakes and the conversations of the app, all registered globally.
 */
export class LeadFreezesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                LeadFreezeRecordsService,
                LeadFreezeItemsService,
                LeadFreezeRunsService,
                LeadFreezeWakesService,
                LeadFreezesService,
                LeadFreezePerformerService,
                LeadFreezeDoorService,
                LeadFreezeAnswersService,
            ],
            exports: [LeadFreezesService, LeadFreezeDoorService],
        }
    }
}
