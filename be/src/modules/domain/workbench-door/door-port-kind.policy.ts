import {
    agentConnectionsPort,
    agentKnowledgePort,
    installationPort,
    membersPort,
    parkedRunsPort,
    rightsPort,
} from "@nivo-lite/blocks-core/modules"
import { DOOR_PORT_ID, OUTBOX_PORT_ID } from "@nivo-lite/agent-sdk/mutation"
import { ENTITIES_PORT_ID, ENTITY_PORT_PREFIX } from "@nivo-lite/agent-sdk/entity/port"

/** Which provider serves a port id: the engine's data and outbox ports, a module's list source, the installation, the workspace's members and their rights, the door (declared, never given to a screen), or none. */
export type DoorPortKind =
    | "engine"
    | "list"
    | "installation"
    | "members"
    | "rights"
    | "agent-connections"
    | "agent-knowledge"
    | "parked-runs"
    | "door"
    | "none"

const LIST_SUFFIX = "-list"

/** The entity an engine entity port id is bound to, or null when the id is not one. */
export const entityOfPortId = (id: string): string | null =>
    id.startsWith(ENTITY_PORT_PREFIX) && id.length > ENTITY_PORT_PREFIX.length
        ? id.slice(ENTITY_PORT_PREFIX.length)
        : null

/**
 * The provider of a port id. The engine serves `engine.entities`, `engine.entity.<name>` and `engine.outbox`; a module's list source
 * (`<module>.<thing>-list`) is the generic one over the engine; `platform.installation` is the installed registry with the workspace's
 * enabled modules; `platform.members` is the active seats of the workspace; `platform.rights` is the permissions those seats hold; `platform.agent-connections`, `platform.agent-knowledge` and `platform.parked-runs` are the agent page regions and the parked runs of the engine. The door port may be declared (a job uses it) but a screen's run is never
 * given it; anything else is not provided at all.
 */
export const portKindOf = (id: string): DoorPortKind => {
    if (id === DOOR_PORT_ID) return "door"
    if (id === installationPort.id) return "installation"
    if (id === membersPort.id) return "members"
    if (id === rightsPort.id) return "rights"
    if (id === agentConnectionsPort.id) return "agent-connections"
    if (id === agentKnowledgePort.id) return "agent-knowledge"
    if (id === parkedRunsPort.id) return "parked-runs"
    if (id === ENTITIES_PORT_ID || id === OUTBOX_PORT_ID || entityOfPortId(id) !== null) return "engine"
    return id.endsWith(LIST_SUFFIX) ? "list" : "none"
}
