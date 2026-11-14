import { Module, type DynamicModule } from "@nestjs/common"
import { CONTACT_FREEZE_STORE } from "./contact-freeze-store.port"
import { TypeormContactFreezeStore } from "./contact-freeze-store.typeorm"
import { LeadFreezeDoorService } from "./lead-freeze-door.service"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import { LeadFreezeStopHoldsService } from "./lead-freeze-stop-holds.service"
import { LeadFreezeStopsService } from "./lead-freeze-stops.service"
import { LeadFreezeWakesService } from "./lead-freeze-wakes.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./lead-freezes.module-definition"
import { LeadFreezesService } from "./lead-freezes.service"

@Module({})
/**
 * The holds of customers whose thread run waits at a stop: a new wake of that customer and workflow is kept as a pending event and
 * replayed once the stop closes. It registers with the gate of the graph flows, the thread runs and the thread sweep when it starts. Its
 * freezes live in public.contact_freezes (`CONTACT_FREEZE_STORE`).
 */
export class LeadFreezesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                // The freezes of people (public.contact_freezes): every freeze read and write goes through this store.
                TypeormContactFreezeStore,
                { provide: CONTACT_FREEZE_STORE, useExisting: TypeormContactFreezeStore },
                LeadFreezeRecordsService,
                LeadFreezeStopsService,
                LeadFreezeStopHoldsService,
                LeadFreezeWakesService,
                LeadFreezesService,
                LeadFreezeDoorService,
            ],
            exports: [LeadFreezesService, LeadFreezeDoorService, LeadFreezeRecordsService],
        }
    }
}
