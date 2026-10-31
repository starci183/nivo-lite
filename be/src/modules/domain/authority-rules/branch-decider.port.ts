import type { Proposal, WorkItem } from "@modules/domain/work-items"
import type { GateVerdict } from "./authority-rules.contracts"

/** One item put in front of the action graph, beside the gate. */
export interface BranchRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The item being judged. */
    readonly item: WorkItem
    /** What the agent proposed. */
    readonly proposal: Proposal
    /** Judges a proposal as the owner rule does, so a graph in shadow can record how far it differs. */
    readonly gate: (proposal: Proposal) => Promise<GateVerdict>
    /** The agent turn whose proposal carried the action, or null. */
    readonly turnId: string | null
    /** The wake that turn answered, or null. */
    readonly wakeId: string | null
}

/** What the action graph decided for one item. */
export interface BranchJudgement {
    /** The proposal the verdict was reached on; in an enforced graph its amount is the one the records hold. */
    readonly proposal: Proposal
    /** The stricter of the gate and the branch. */
    readonly verdict: GateVerdict
    /** The recorded decision, for the approval that follows. */
    readonly decisionId: string
}

/** What the action graph decided for an item, or null when it has no say. */
export type OptionalBranchJudgement = BranchJudgement | null

/** The one door to the action graph, beside the gate: bound at the app root, and absent until a graph exists. */
export interface WorkBranchDecider {
    /**
     * Reads the facts of the item from real records, picks the branch, records the decision and answers the judgement. Null means
     * the graph has no say (no graph, a graph still in shadow, no decide point for the action, or a failure) and the gate decides alone.
     */
    decide(request: BranchRequest): Promise<OptionalBranchJudgement>
}
