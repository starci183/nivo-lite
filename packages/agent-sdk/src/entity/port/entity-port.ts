import { definePort } from "../../port/port"
import type { PortDefinition } from "../../port/port.types"
import type { AnyEntityDefinition } from "../entity-any.types"
import type { EntitiesApi, EntityApi } from "./entity-port.types"

/** The port id of the multi-entity data port: every entity of the catalog through one handle. */
export const ENTITIES_PORT_ID = "engine.entities"

/** The prefix of the id of a data port bound to one entity: `engine.entity.<entity name>`. */
export const ENTITY_PORT_PREFIX = "engine.entity."

/** The multi-entity data port declaration a job, action or read lists in its ports. */
export const ENTITIES_PORT: PortDefinition<EntitiesApi> = definePort<EntitiesApi>(ENTITIES_PORT_ID)

/** The port id of the data port bound to the entity `name`. */
export const entityPortIdOf = (name: string): `${typeof ENTITY_PORT_PREFIX}${string}` => `${ENTITY_PORT_PREFIX}${name}`

/**
 * The data port declaration of one entity (`engine.entity.<name>`): the engine binds it to the scope of the request. Built without
 * `definePort`, whose id check admits `<namespace>.<name>` only; the entity name is already checked by `defineEntity`.
 */
export const entityPort = (entity: AnyEntityDefinition): PortDefinition<EntityApi> => ({
    entry: "port",
    id: entityPortIdOf(entity.name),
})
