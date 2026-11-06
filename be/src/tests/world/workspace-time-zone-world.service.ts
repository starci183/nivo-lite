import { WorkspaceTimeZoneService } from "@modules/domain/workbench-door"
import type { LiteWorld } from "./lite-world.service"

/** The reader of the workspace time zone the door uses, from the world's module graph. */
export const zoneReaderOf = (world: LiteWorld): WorkspaceTimeZoneService => world.resolve(WorkspaceTimeZoneService)
