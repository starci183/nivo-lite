import type { DoorCallResult } from "@nivo-lite/agent-sdk/mutation"

/**
 * The door tools the internal "nivo" agent holds, as data: exactly the tools the declared jobs of the flow F modules call (the `tools`
 * of their module declarations and the agent turn and history reads of the turn sync). Every other tool is default deny.
 */
export const DOOR_GRANTS: ReadonlyArray<string> = [
    "chat.send",
    "ledger.append",
    "ledger.status",
    "ai.agent.turn",
    "ai.agent.history",
]

/** Whether the internal agent holds this door tool. */
export const isDoorGranted = (tool: string): boolean => DOOR_GRANTS.includes(tool)

/** The answer for a door tool the internal agent does not hold. */
export const NOT_GRANTED: DoorCallResult = { ok: false, reason: "forbidden", message: "not_granted" }
