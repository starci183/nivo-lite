import type { AgentTurnView, AgentWakeView } from "./agent-work.contracts"

/** A wake that ended inside `begin`, with no turn to hand a handler: held by a switch that is off, or dead past its attempts. */
export interface AgentEndedWake {
    /** Held by a switch, or dead. */
    readonly state: "held" | "dead"
    /** The wake. */
    readonly wake: AgentWakeView
}

/** What `begin` answered. */
export type AgentBegin =
    | { readonly result: "killed" | "busy" | "idle"; readonly ended: ReadonlyArray<AgentEndedWake> }
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
