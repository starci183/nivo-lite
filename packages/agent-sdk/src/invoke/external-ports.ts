import type { PortMap } from "../port/port.types"
import { DOOR_PORT_ID } from "../mutation/door-port"
import { WORKFLOW_PORT_ID } from "../mutation/workflow-port"

/** The ports that reach outside the database: a transaction never holds one open (BE-PERSISTENCE-6, R82). */
export const EXTERNAL_PORT_IDS: ReadonlyArray<string> = [DOOR_PORT_ID, WORKFLOW_PORT_ID]

/** Whether a port map holds a port that reaches outside the database. */
export const hasExternalPort = (ports: PortMap | undefined): boolean =>
    Object.values(ports ?? {}).some((port) => EXTERNAL_PORT_IDS.includes(port.id))
