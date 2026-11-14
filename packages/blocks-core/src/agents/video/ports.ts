import { entityPort, type EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { videoBrandKitEntity } from "./entities/brand-kit.entity"
import { videoProjectEntity } from "./entities/project.entity"
import { videoRenderEntity } from "./entities/render.entity"

/*
 * The data of the Video module is the engine's: every row is a record of a declared type, read and written through its entity port;
 * the module has no store of its own.
 */

/** The port of the video projects (`blocks-core.video.project`). */
export const PROJECTS: PortDefinition<EntityApi> = entityPort(videoProjectEntity)

/** The port of the makings of the projects' videos (`blocks-core.video.render`). */
export const RENDERS: PortDefinition<EntityApi> = entityPort(videoRenderEntity)

/** The port of the brand kit of the workspace (`blocks-core.video.brand-kit`), one record. */
export const BRAND: PortDefinition<EntityApi> = entityPort(videoBrandKitEntity)
