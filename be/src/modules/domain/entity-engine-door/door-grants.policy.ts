import type { DoorCallResult } from "@nivo-lite/agent-sdk/mutation"

/**
 * The door tools the internal "nivo" agent holds, as data: exactly the tools the declared jobs of the flow F modules call (the `tools`
 * of their module declarations and the agent turn and history reads of the turn sync). Every other tool is default deny.
 */
export const DOOR_GRANTS: ReadonlyArray<string> = [
    "chat.send",
    "team-chat.post-report",
    "team-chat.post-approval",
    "ledger.append",
    "ledger.status",
    "ai.agent.turn",
    "ai.agent.history",
]

/** The module key of the internal agent: the workspace row seeds one `agents` row of this module (its grants are the gateway names of `DOOR_GRANTS`). */
export const NIVO_AGENT_MODULE = "nivo"

/** Whether the internal agent holds this door tool. */
export const isDoorGranted = (tool: string): boolean => DOOR_GRANTS.includes(tool)

/** The answer for a door tool the internal agent does not hold. */
export const NOT_GRANTED: DoorCallResult = { ok: false, reason: "forbidden", message: "not_granted" }
