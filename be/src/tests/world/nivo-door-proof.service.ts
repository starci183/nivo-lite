import { EngineDoorService } from "@modules/domain/entity-engine-door"
import { ModuleJobRunnerService } from "@modules/domain/entity-engine"
import type { LiteWorld } from "./lite-world.service"

/** Binds the door of the app to the runner of declared jobs, as the door capability does at boot, so a proof runs a job that calls the door. */
export const bindJobDoor = (world: Pick<LiteWorld, "resolve">): void => {
    world.resolve(ModuleJobRunnerService).bindDoor(world.resolve(EngineDoorService))
}
