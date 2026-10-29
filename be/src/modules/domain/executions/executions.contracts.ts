/** An approval card as the decision flow reads it. */
export interface ExecutionRow {
    /** The execution id. */
    id: string
    /** `pending_approval`, `approved` or `rejected`. */
    status: string
    /** The work item the card belongs to, when there is one. */
    work_item_id: string | null
    /** The draft the person approves. */
    draft: string
}

/** An approval card selected for a workspace's lead and sales views. */
export interface ExecutionRecordRow extends ExecutionRow {
    /** The workspace that owns the card. */
    readonly workspace_id: string
    /** The responsibility the draft belongs to. */
    readonly responsibility_id: string
    /** The agent that wrote the draft, when there is one. */
    readonly agent_id: string | null
    /** The draft's action kind. */
    readonly kind: string
    /** The person that decided the card, when decided. */
    readonly decided_by: string | null
    /** The decision time as ISO 8601 text, when decided. */
    readonly decided_at: string | null
    /** The creation time as ISO 8601 text. */
    readonly created_at: string
}

/** The status of one approval card. */
export interface ExecutionStatusLine {
    /** The execution id. */
    readonly id: string
    /** `pending_approval`, `approved` or `rejected`. */
    readonly status: string
}

/** A complete approval card, or null when the workspace has no such card. */
export type OptionalExecutionRecord = ExecutionRecordRow | null

/** What an approval card is made of. */
export interface NewExecution {
    /** The workspace. */
    readonly workspaceId: string
    /** The responsibility the draft belongs to. */
    readonly responsibilityId: string
    /** The agent that wrote the draft, when there is one. */
    readonly agentId: string | null
    /** The text the person approves. */
    readonly draft: string
    /** The work item it belongs to. */
    readonly workItemId: string
}

/** How a person settles a card. */
export type ExecutionDecision = "approved" | "rejected"

/** An approval card, or null when the workspace has no such card. */
export type OptionalExecution = ExecutionRow | null

/** What settling a card takes. */
export interface ExecutionSettlement {
    /** The workspace. */
    readonly workspaceId: string
    /** The card. */
    readonly executionId: string
    /** The outcome. */
    readonly decision: ExecutionDecision
    /** The display name of the decider. */
    readonly decidedBy: string
    /** The draft the person edited, when they did. */
    readonly editedDraft: string | null
}

/** Filters and bounds an approval-card read. */
export interface ExecutionListFilter {
    /** Restricts cards to these responsibilities; an empty list selects none. */
    readonly responsibilityIds?: ReadonlyArray<string>
    /** Selects undecided legacy cards that are not attached to a work item. */
    readonly pendingLegacy?: boolean
    /** The maximum number of cards the caller needs. */
    readonly limit: number
}
