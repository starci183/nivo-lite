import type { GraphEvidence, Proposal, WorkItem } from "@modules/domain/work-items"
import type { GateVerdict } from "./authority-rules.contracts"

/** The road an action left by: a work item, a customer reply, a write tool or a conversation hand-over. */
export type GraphRoad = "work" | "reply" | "tool" | "handover"

/** The hand-over a branch names: the proposal does not run, and this action does on the same subject. */
export interface BranchDivert {
    /** The action the graph leads to. */
    readonly action: string
    /** The agent or department the node hands to, or null when the action names its own. */
    readonly handoverTo: string | null
    /** True when the path went through an approval, so a person decides the diverted work. */
    readonly asks: boolean
}

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
    /** The recorded decision, for the approval that follows; null when the graph could not be read, so nothing names an approver. */
    readonly decisionId: string | null
    /** True when the path stopped: the work ends here, and no person can approve it through. */
    readonly stopped: boolean
    /** The action the branch leads to in place of this one, or null. */
    readonly divert: BranchDivert | null
}

/** What the action graph decided for an item, or null when it has no say. */
export type OptionalBranchJudgement = BranchJudgement | null

/** Something an agent is about to do that leaves no work item: judged by the same walk before it leaves. */
export interface GraphCheck {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent instance acting, or null when none is known. */
    readonly installationId: string | null
    /** The action key. */
    readonly action: string
    /** The road it leaves by. */
    readonly road: Exclude<GraphRoad, "work">
    /** The key of this exact proposal: the same one twice writes one run. */
    readonly key: string
    /** The type of the subject. */
    readonly subjectType: string
    /** The id of the subject, or null. */
    readonly subjectId: string | null
    /** The customer, or null. */
    readonly leadId: string | null
    /** The text that would really leave, or null. */
    readonly text: string | null
    /** What the turn knows, carried for the plug-ins that read it; null on a road that has none. */
    readonly evidence: ReadonlyArray<GraphEvidence> | null
    /** What the road knows about the call, by fact key. */
    readonly attributes: Readonly<Record<string, string>>
    /** The agent turn, or null. */
    readonly turnId: string | null
    /** The wake of that turn, or null. */
    readonly wakeId: string | null
    /** True when an ask opens a work item, which records the run itself. */
    readonly askOpensWork: boolean
}

/** What the graph answers about something that leaves no work item. */
export interface GraphAnswer {
    /** Run it, ask a person, stop it, or run another action in its place. */
    readonly outcome: "run" | "ask" | "stop" | "divert"
    /** The facts the condition needed and could not read. */
    readonly unread: ReadonlyArray<string>
    /** Why the graph could not judge it, or null when it did. */
    readonly unjudged: string | null
    /** The action the branch leads to in place of this one, or null. */
    readonly divert: BranchDivert | null
}

/** The one door to the action graph, beside the gate: bound at the app root, and absent until a graph exists. */
export interface WorkBranchDecider {
    /**
     * Reads the facts of the item, walks the graph, records the run and answers the judgement. Null means the graph has no say (no
     * graph, a graph the owner set to shadow, or an action no node holds) and the gate decides alone; a graph that holds the action and
     * cannot be read or walked answers an ask, never null.
     */
    decide(request: BranchRequest): Promise<OptionalBranchJudgement>

    /** Walks the graph for what leaves with no work item and records the run; a graph with no say answers `run`. */
    check(request: GraphCheck): Promise<GraphAnswer>

    /** Puts the waiting item in front of the approver its branch named; an item whose branch named nobody stays with the people who govern. */
    route(route: BranchRoute): Promise<void>

    /** False while a request the branch opened is open and the answerer is neither one of the people it asked nor the owner of the workspace. */
    mayDecide(answerer: BranchAnswerer): Promise<boolean>
}
