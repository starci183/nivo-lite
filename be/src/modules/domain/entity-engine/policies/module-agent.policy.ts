import { ENTITIES_PORT_ID } from "@nivo-lite/agent-sdk/entity/port"
import { entityOfPortId } from "../port-id.policy"

/** Whether a set of declared ports reaches records (the multi-entity port or one entity's port): the ports of a job that needs its module's agent. */
export const reachesRecords = (ports: Readonly<Record<string, { readonly id: string }>>): boolean =>
    Object.values(ports).some((port) => port.id === ENTITIES_PORT_ID || entityOfPortId(port.id) !== null)
