import type { GateVerdict, Proposal, WorkItem, WorkOrigin } from "./decisions.contracts"
import type { Judgement } from "./work-engine.contracts"

/** What the engine asks the action graph about an item it is about to judge. */
export interface BranchConsult {
    /** The workspace. */
    readonly workspaceId: string
    /** The item being judged. */
    readonly item: WorkItem
    /** What the agent proposed. */
    readonly proposal: Proposal
    /** The turn and wake the work came from, or null for work that did not come from a turn. */
    readonly origin: WorkOrigin | null
    /** Judges a proposal as the owner rule does. */
    readonly gate: (proposal: Proposal) => Promise<GateVerdict>
}

/** What the graph and the gate came to: the proposal to judge, the verdict before any forced ask, and what a waiting item keeps. */
export interface BranchOutcome {
    /** The proposal to judge: the graph's when it replaced the amount, else the agent's. */
    readonly proposal: Proposal
    /** The verdict of the branch, or of the gate when the graph had no say. */
    readonly verdict: GateVerdict
    /** The proposal and the decision the graph recorded, absent when the gate decided alone. */
    readonly carried: Pick<Judgement, "proposal" | "branchDecisionId">
}
