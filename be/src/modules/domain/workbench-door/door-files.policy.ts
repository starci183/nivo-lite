import { entityPortIdOf } from "@nivo-lite/agent-sdk/entity/port"
import type { PortMap } from "@nivo-lite/agent-sdk/port"
import { WorkbenchDoorError, WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import type { DoorRegistry } from "./workbench-door.contracts"

/**
 * What a screen does with a record's file through the door: upload one (ticket, confirm), attach one to the record's field (link),
 * remove the field's file (delete), or read one (url).
 */
export type DoorFileVerb = "upload" | "link" | "delete" | "url"

/** What a file call is granted by: the read or action it is made for. */
export interface DoorFileGrant {
    /** The permission the read or action declares (named in a refusal). */
    readonly permission: string
    /** Whether a staff member may make the call: every member may read a file's address; a write needs the action's staff mark. */
    readonly staff: boolean
}

/** True when the ports a read or action declares reach the record type through its own entity port (`engine.entity.<type>`). */
const reaches = (ports: PortMap | undefined, type: string): boolean => {
    const id = entityPortIdOf(type)
    return Object.values(ports ?? {}).some((port) => port.id === id)
}

/**
 * The grant of a file call, by the read or action it is made `via` (a module's own declaration: no new permission, no module code in
 * the door). An upload is made for an ACTION the door serves (the one that will store the reference); a link for an action or a READ
 * it serves. Either must declare the record type's entity port, so a screen reaches the files of exactly the record types its module's
 * reads and actions already reach. `ActionUnknown` / `ReadUnknown` for a `via` the door does not serve, `FileNotDeclared` for one
 * that does not reach the type.
 */
export const fileGrantOf = (registry: DoorRegistry, via: string, type: string, verb: DoorFileVerb): DoorFileGrant => {
    const action = registry.actions.get(via)
    const read = verb === "url" ? registry.reads.get(via)?.definition : undefined
    const declared = action ?? read
    if (declared === undefined) {
        const code = verb === "url" ? WorkbenchDoorErrorCode.ReadUnknown : WorkbenchDoorErrorCode.ActionUnknown
        throw new WorkbenchDoorError({ code, params: { name: via } })
    }
    if (!reaches(declared.ports, type)) {
        throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.FileNotDeclared, params: { name: via, type } })
    }
    return { permission: declared.permission, staff: verb === "url" || action?.staff === true }
}
