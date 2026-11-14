import { entityPort, type EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { contentBrandEntity } from "./entities/brand.entity"
import { contentPostEntity } from "./entities/post.entity"

/*
 * The data of the Content module is the engine's: every row is a record of a declared type, read and written through its entity port;
 * the module has no store of its own.
 */

/** The port of the posts (`blocks-core.content.post`). */
export const POSTS: PortDefinition<EntityApi> = entityPort(contentPostEntity)

/** The port of the brand of the workspace (`blocks-core.content.brand`), one record. */
export const BRAND: PortDefinition<EntityApi> = entityPort(contentBrandEntity)
