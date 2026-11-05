import { DOOR_PORT_ID, OUTBOX_PORT_ID } from "@nivo-lite/agent-sdk/mutation"
import { ENTITIES_PORT_ID, ENTITY_PORT_PREFIX } from "@modules/domain/entity-engine"

/** Which provider serves a port id: the engine's data and outbox ports, a module's list source, the door (declared, never given to a screen), or none. */
export type DoorPortKind = "engine" | "list" | "door" | "none"

const LIST_SUFFIX = "-list"

/** The entity an engine entity port id is bound to, or null when the id is not one. */
export const entityOfPortId = (id: string): string | null =>
    id.startsWith(ENTITY_PORT_PREFIX) && id.length > ENTITY_PORT_PREFIX.length
        ? id.slice(ENTITY_PORT_PREFIX.length)
        : null

/**
 * The provider of a port id. The engine serves `engine.entities`, `engine.entity.<name>` and `engine.outbox`; a module's list source
 * (`<module>.<thing>-list`) is the generic one over the engine. The door port may be declared (a job uses it) but a screen's run is never
 * given it; anything else is not provided at all.
 */
export const portKindOf = (id: string): DoorPortKind => {
    if (id === DOOR_PORT_ID) return "door"
    if (id === ENTITIES_PORT_ID || id === OUTBOX_PORT_ID || entityOfPortId(id) !== null) return "engine"
    return id.endsWith(LIST_SUFFIX) ? "list" : "none"
}
