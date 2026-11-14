import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-doors.module-definition"
import { CareOptOutService } from "./care-opt-out.service"
import { DoorPressesService } from "./door-presses.service"
import { HoldReleaseDoorService } from "./hold-release-door.service"
import { ScheduledItemsService } from "./scheduled-items.service"

@Module({})
/**
 * The owner's doors onto the agents' work (package D1): the schedule list with "run now" (the schedule list with "run now"), the
 * shop's care opt-out of a customer, and "hand back to the agent" for a held conversation. Each is owner- or manager-gated and acts through
 * the engine's own paths; `agent_door_presses` remembers who pressed and when. It needs the work core, the schedules, the threads, the
 * graphs, the installations, the members and the lead memory of the app, all registered globally.
 */
export class AgentDoorsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app that serves people. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                DoorPressesService,
                ScheduledItemsService,
                CareOptOutService,
                HoldReleaseDoorService,
            ],
            exports: [
                DoorPressesService,
                ScheduledItemsService,
                CareOptOutService,
                HoldReleaseDoorService,
            ],
        }
    }
}
