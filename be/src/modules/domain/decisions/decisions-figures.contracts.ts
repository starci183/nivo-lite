/** A decision of the last days as the governance figures count it. */
export interface DecisionFigure {
    /** The work item the decision was about, or null. */
    readonly workItemId: string | null
    /** The customer it was about, or null. */
    readonly leadId: string | null
    /** Who decided: a policy, a person or an agent. */
    readonly deciderKind: string
    /** What was decided. */
    readonly outcome: string
    /** When it was decided. */
    readonly createdAt: Date
}

/** A decision as the recent-decisions list of the dashboard shows it. */
export interface RecentDecision {
    /** The decision id. */
    readonly id: string
    /** The work item the decision was about, or null. */
    readonly workItemId: string | null
    /** The customer it was about, or null. */
    readonly leadId: string | null
    /** The department. */
    readonly department: string
    /** The action decided on. */
    readonly action: string
    /** Who decided. */
    readonly decidedBy: string
    /** Who decided: a policy, a person or an agent. */
    readonly deciderKind: string
    /** What was decided. */
    readonly outcome: string
    /** The reason, or null. */
    readonly reason: string | null
    /** The note, or null. */
    readonly note: string | null
    /** When it was decided. */
    readonly createdAt: Date
}
