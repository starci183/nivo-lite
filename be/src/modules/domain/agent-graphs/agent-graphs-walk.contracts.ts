import type { BranchApprover } from "./agent-graphs.contracts"

/** What a walk of the graph came to: run, ask, stop, another action in place of this one, or nothing the graph holds. */
export type WalkOutcome = "run" | "ask" | "stop" | "divert" | "unheld"

/** Why a walk could not judge the action, so it asked or was left to the gate. */
export type WalkUnjudged = "fact_unread" | "no_route" | "no_else" | "not_in_graph"

/** What one walk of the graph came to. */
export interface GraphWalk {
    /** The outcome. */
    readonly outcome: WalkOutcome
    /** The keys of the nodes the walk went through. */
    readonly path: ReadonlyArray<string>
    /** The last branch taken, or the node the walk entered at when no branch decided. */
    readonly branchKey: string
    /** The approver of the branch or the node that asked, or null. */
    readonly approver: BranchApprover | null
    /** The action the path leads to in place of this one, or null. */
    readonly divert: { readonly action: string; readonly handoverTo: string | null; readonly asks: boolean } | null
    /** The facts a condition needed and could not read. */
    readonly unread: ReadonlyArray<string>
    /** Why it could not be judged, or null. */
    readonly unjudged: WalkUnjudged | null
}
