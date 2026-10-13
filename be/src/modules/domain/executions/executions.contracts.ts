import type { ExecutionRecordRow, ExecutionRow } from "./persistence/executions.rows"

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
