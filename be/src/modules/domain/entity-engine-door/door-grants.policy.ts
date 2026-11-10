import type { DoorCallResult } from "@nivo-lite/agent-sdk/mutation"

/**
 * The door tools the internal "nivo" agent holds, as data: exactly the tools the declared jobs of the flow F modules call (the `tools`
 * of their module declarations and `nivo.chat.profile.get` of the Zalo profile round). Every other tool is default deny.
 */
export const DOOR_GRANTS: ReadonlyArray<string> = [
    "nivo.chat.send",
    "nivo.team-chat.report.post",
    "nivo.team-chat.approval.post",
    "nivo.chat.profile.get",
    "nivo.ledger.entry.append",
    "nivo.ledger.status.get",
]

/** The module key of the internal agent: the workspace row seeds one `agents` row of this module (its grants are the gateway names of `DOOR_GRANTS`). */
export const NIVO_AGENT_MODULE = "nivo"

/** Whether the internal agent holds this door tool. */
export const isDoorGranted = (tool: string): boolean => DOOR_GRANTS.includes(tool)

/** The answer for a door tool the internal agent does not hold. */
export const NOT_GRANTED: DoorCallResult = { ok: false, reason: "forbidden", message: "not_granted" }
