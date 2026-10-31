import type { GatewayCaller } from "./mcp-gateway.contracts"

/** How long a turn stays tainted after a tool answered with text a stranger may have written, milliseconds. */
export const TAINT_WINDOW_MS = 15 * 60_000

/**
 * The turn a call belongs to: the agent turn when the caller names one, else the customer conversation, else the work item, else the
 * agent's own session on the door (the door has no turn id, so the window bounds it). A key never mixes two agents or two workspaces.
 */
export const turnKeyOf = (caller: GatewayCaller): string =>
    `${caller.workspaceId}:${caller.agentId}:${caller.turnId ?? caller.conversationId ?? caller.workItemId ?? "door"}`

/** True when the turn read tainted text within the window ending at `now`. */
export const isTainted = (marks: ReadonlyMap<string, number>, caller: GatewayCaller, now: number): boolean => {
    const at = marks.get(turnKeyOf(caller))
    return at !== undefined && now - at <= TAINT_WINDOW_MS
}

/** The marks after this turn read tainted text at `now`, with the marks that ran out dropped so the table stays small. */
export const withTaint = (
    marks: ReadonlyMap<string, number>,
    caller: GatewayCaller,
    now: number,
): ReadonlyMap<string, number> => {
    const live = [...marks].filter(([, at]) => now - at <= TAINT_WINDOW_MS)
    return new Map([...live, [turnKeyOf(caller), now]])
}
