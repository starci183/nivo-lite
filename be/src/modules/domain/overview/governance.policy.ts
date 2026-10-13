import type { OverviewGovernance, OverviewGovernanceDecision, OverviewGovernanceWork } from "./overview.contracts"

/** Where a work item stands in the governance queue. */
export enum GovernanceWorkStatus {
    /** Leaves the item waiting for a worker. */
    Queued = "queued",
    /** Closes the item as finished. */
    Done = "done",
    /** Holds the item until a person decides. */
    WaitingDecision = "waiting_decision",
    /** Closes the item as refused. */
    Rejected = "rejected",
    /** Closes the item as a failed run. */
    Failed = "failed",
}

/** How a work item was decided. */
export enum GovernanceDecidedPath {
    /** Records that policy finished the item alone. */
    Auto = "auto",
    /** Records that a person finished the item. */
    Human = "human",
}

/** Why the gate decided what it decided. */
export enum GovernanceWorkReason {
    /** Lets the item continue on the ordinary path. */
    Routine = "routine",
    /** Stops the item until the missing fact arrives. */
    MissingData = "missing_data",
    /** Stops the item because it exceeds the owner's authority. */
    OverAuthority = "over_authority",
    /** Stops the item because the outcome is not clear. */
    UnclearOutcome = "unclear_outcome",
    /** Refuses the item because the action is not allowed. */
    NotAllowed = "not_allowed",
}

/** Who decided. */
export enum GovernanceDeciderKind {
    /** Records that policy decided. */
    Policy = "policy",
    /** Records that an owner decided. */
    Owner = "owner",
    /** Records that a staff member decided. */
    Staff = "staff",
}

/** What the decision did. */
export enum GovernanceDecisionOutcome {
    /** Records that policy finished the item. */
    AutoDone = "auto_done",
    /** Records that a person approved the proposal. */
    Approved = "approved",
    /** Records that a person changed the proposal and then approved it. */
    Edited = "edited",
    /** Records that a person refused the proposal. */
    Rejected = "rejected",
}

/** A work row as the dashboard query returns it, before the closed words become enums. */
interface RawGovernanceWork {
    readonly id: string
    readonly leadId: string | null
    readonly department: string
    readonly status: string
    readonly reason: string | null
    readonly decidedPath: string | null
    readonly createdAt: string
    readonly updatedAt: string
    readonly completedAt: string | null
    readonly summary: string | null
    readonly contact: string | null
    readonly customer: string | null
}

/** A decision row as the dashboard query returns it. */
interface RawGovernanceDecision {
    readonly workItemId: string | null
    readonly leadId: string | null
    readonly deciderKind: string
    readonly outcome: string
    readonly createdAt: string
}

/** The governance block as the dashboard query returns it. */
export interface RawGovernance extends Omit<OverviewGovernance, "work" | "decisions7"> {
    /** The newest work items, still carrying the stored words. */
    readonly work: ReadonlyArray<RawGovernanceWork>
    /** The decisions of the last 7 days, still carrying the stored words. */
    readonly decisions7: ReadonlyArray<RawGovernanceDecision>
}

const WORK_STATUS = new Map<string, GovernanceWorkStatus>([
    [GovernanceWorkStatus.Queued, GovernanceWorkStatus.Queued],
    [GovernanceWorkStatus.Done, GovernanceWorkStatus.Done],
    [GovernanceWorkStatus.WaitingDecision, GovernanceWorkStatus.WaitingDecision],
    [GovernanceWorkStatus.Rejected, GovernanceWorkStatus.Rejected],
    [GovernanceWorkStatus.Failed, GovernanceWorkStatus.Failed],
])

const DECIDED_PATH = new Map<string, GovernanceDecidedPath>([
    [GovernanceDecidedPath.Auto, GovernanceDecidedPath.Auto],
    [GovernanceDecidedPath.Human, GovernanceDecidedPath.Human],
])

const WORK_REASON = new Map<string, GovernanceWorkReason>([
    [GovernanceWorkReason.Routine, GovernanceWorkReason.Routine],
    [GovernanceWorkReason.MissingData, GovernanceWorkReason.MissingData],
    [GovernanceWorkReason.OverAuthority, GovernanceWorkReason.OverAuthority],
    [GovernanceWorkReason.UnclearOutcome, GovernanceWorkReason.UnclearOutcome],
    [GovernanceWorkReason.NotAllowed, GovernanceWorkReason.NotAllowed],
])

const DECIDER_KIND = new Map<string, GovernanceDeciderKind>([
    [GovernanceDeciderKind.Policy, GovernanceDeciderKind.Policy],
    [GovernanceDeciderKind.Owner, GovernanceDeciderKind.Owner],
    [GovernanceDeciderKind.Staff, GovernanceDeciderKind.Staff],
])

const DECISION_OUTCOME = new Map<string, GovernanceDecisionOutcome>([
    [GovernanceDecisionOutcome.AutoDone, GovernanceDecisionOutcome.AutoDone],
    [GovernanceDecisionOutcome.Approved, GovernanceDecisionOutcome.Approved],
    [GovernanceDecisionOutcome.Edited, GovernanceDecisionOutcome.Edited],
    [GovernanceDecisionOutcome.Rejected, GovernanceDecisionOutcome.Rejected],
])

const workStatusOf = (status: string): GovernanceWorkStatus => WORK_STATUS.get(status) ?? GovernanceWorkStatus.Queued

const decidedPathOf = (path: string | null): GovernanceDecidedPath | null => {
    if (path === null) return null
    return DECIDED_PATH.get(path) ?? null
}

const workReasonOf = (reason: string | null): GovernanceWorkReason | null => {
    if (reason === null) return null
    return WORK_REASON.get(reason) ?? null
}

const deciderKindOf = (kind: string): GovernanceDeciderKind => DECIDER_KIND.get(kind) ?? GovernanceDeciderKind.Policy

const decisionOutcomeOf = (outcome: string): GovernanceDecisionOutcome =>
    DECISION_OUTCOME.get(outcome) ?? GovernanceDecisionOutcome.Approved

const presentWork = (work: RawGovernanceWork): OverviewGovernanceWork => ({
    ...work,
    status: workStatusOf(work.status),
    reason: workReasonOf(work.reason),
    decidedPath: decidedPathOf(work.decidedPath),
})

const presentDecision = (decision: RawGovernanceDecision): OverviewGovernanceDecision => ({
    ...decision,
    deciderKind: deciderKindOf(decision.deciderKind),
    outcome: decisionOutcomeOf(decision.outcome),
})

/** Turns the dashboard's governance words into the closed enums the console reads. */
export const presentGovernance = (raw: RawGovernance): OverviewGovernance => ({
    ...raw,
    work: raw.work.map(presentWork),
    decisions7: raw.decisions7.map(presentDecision),
})
