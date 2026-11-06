import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { WORKBENCH_DOOR_OPTIONS } from "./workbench-door.decorators"
import { DoorPortsService } from "./door-ports.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./workbench-door.module-definition"
import { WorkspaceTimeZoneService } from "./workspace-time-zone.service"
import { WorkbenchDoorService } from "./workbench-door.service"

@Module({})
/** The one door every screen's read and action goes through: membership, permission, authority, then the run on the engine's ports. */
export class WorkbenchDoorModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: WORKBENCH_DOOR_OPTIONS, useValue: options },
                DoorPortsService,
                WorkspaceTimeZoneService,
                WorkbenchDoorService,
            ],
            exports: [WorkbenchDoorService],
        }
    }
}
