import { ENTITY_PORT_PREFIX } from "./entity-engine.contracts"

/** The port id of the data port bound to one entity. */
export const entityPortId = (entity: string): string => `${ENTITY_PORT_PREFIX}${entity}`

/** The entity a data port id is bound to, or null when the id is not an entity port id. */
export const entityOfPortId = (id: string): string | null =>
    id.startsWith(ENTITY_PORT_PREFIX) && id.length > ENTITY_PORT_PREFIX.length
        ? id.slice(ENTITY_PORT_PREFIX.length)
        : null
