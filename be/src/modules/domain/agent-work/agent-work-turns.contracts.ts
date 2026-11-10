import type { AgentTurnView, AgentWakeView } from "./agent-work.contracts"

/** A wake that ended inside `begin`, with no turn to hand a handler: held by a switch that is off, or dead past its attempts. */
export interface AgentEndedWake {
    /** Held by a switch, or dead. */
    readonly state: "held" | "dead"
    /** The wake. */
    readonly wake: AgentWakeView
}

/**
 * The wait `begin` told a drain that came while the burst window of its conversation was still open: how long is left by the
 * database's own clock, and the wake the wait is for (the newest of the conversation).
 */
export interface AgentBeginWait {
    /** Milliseconds until the window ends, as the database counts them; at least one. */
    readonly ms: number
    /** The newest pending wake of the scope, the one the window is counted from. */
    readonly wakeId: string
}

/** What `begin` answered. An `idle` scope with a `wait` has a wake that is not due yet: the drain is to come back after the wait. */
export type AgentBegin =
    | { readonly result: "killed" | "busy"; readonly ended: ReadonlyArray<AgentEndedWake> }
    | { readonly result: "idle"; readonly ended: ReadonlyArray<AgentEndedWake>; readonly wait?: AgentBeginWait }
    | { readonly result: "begun"; readonly turn: AgentTurnView; readonly ended: ReadonlyArray<AgentEndedWake> }

/** What `propose` answered. */
export type AgentProposeResult = "stored" | "fenced" | "killed"

/** What `finish` answered. */
export interface AgentFinish {
    /** True when the lease had moved on, so nothing was written. */
    readonly fenced: boolean
    /** True when another wake of the scope is due now. */
    readonly more: boolean
}
