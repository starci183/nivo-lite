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

/** An item that waits because a branch of the graph asked: the decision that asked, so the named approver can be put in front of it. */
export interface BranchRoute {
    /** The workspace. */
    readonly workspaceId: string
    /** The item that waits. */
    readonly workItemId: string
    /** The decision the graph recorded for it. */
    readonly decisionId: string
}

/** Who is answering a waiting item, for the check that a branch ask is answered by the approver it named. */
export interface BranchAnswerer {
    /** The workspace. */
    readonly workspaceId: string
    /** The item that waits. */
    readonly workItemId: string
    /** The seat that answers. */
    readonly memberId: string
    /** True for the owner of the workspace, who may always answer. */
    readonly isOwner: boolean
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

    /** Puts the waiting item in front of the approver its branch named; an item whose branch named nobody stays with the people who govern. */
    route(route: BranchRoute): Promise<void>

    /** False while a request the branch opened is open and the answerer is neither one of the people it asked nor the owner of the workspace. */
    mayDecide(answerer: BranchAnswerer): Promise<boolean>
}
