import { ENTITY_PORT_PREFIX } from "@nivo-lite/agent-sdk/entity/port"

/** The entity a data port id is bound to, or null when the id is not an entity port id. */
export const entityOfPortId = (id: string): string | null =>
    id.startsWith(ENTITY_PORT_PREFIX) && id.length > ENTITY_PORT_PREFIX.length
        ? id.slice(ENTITY_PORT_PREFIX.length)
        : null
