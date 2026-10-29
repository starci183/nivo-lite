/** One recent work item of a department, with the lead's name folded in. */
export interface RecentWorkLine {
    /** The work item. */
    readonly id: string
    /** The action key. */
    readonly action: string
    /** queued, done, waiting_decision, rejected or failed. */
    readonly status: "queued" | "done" | "waiting_decision" | "rejected" | "failed"
    /** When it was last touched, ISO 8601 as the query writes it. */
    readonly at: string
    /** The one-line summary, or null. */
    readonly summary: string | null
    /** The customer, or null. */
    readonly customer: string | null
    /** The lead, or null. */
    readonly leadId: string | null
}

/** Which dashboard list of a department's work items is read. */
export type DashboardListKind = "waiting" | "done"

/** The scope of one dashboard list. */
export interface DashboardListQuery {
    /** The workspace. */
    readonly workspaceId: string
    /** The department (module key) whose work is listed. */
    readonly department: string
    /** The instance the list narrows to, or null for the whole department. */
    readonly installationId: string | null
    /** Waiting for a decision, or done alone since a moment. */
    readonly kind: DashboardListKind
    /** Done lists only: the earliest completion moment shown. */
    readonly since: Date | null
    /** The text pattern that marks a test run; matching items are left out. */
    readonly testRunPattern: string
    /** The most lines read. */
    readonly limit: number
}

/** One line of a dashboard list; `total` counts the lines before the limit. */
export interface DashboardListLine {
    /** The work item. */
    readonly id: string
    /** The action key. */
    readonly action: string
    /** The lead, or null. */
    readonly leadId: string | null
    /** When the item was raised (waiting) or finished (done), ISO 8601 as the query writes it. */
    readonly at: string
    /** The proposal or result summary, or null. */
    readonly summary: string | null
    /** The customer name, or null. */
    readonly customer: string | null
    /** The href the finished work recorded, or null. */
    readonly resultHref: string | null
    /** How many lines match before the limit. */
    readonly total: string
}

/** One customer-reply work item waiting for a decision. */
export interface WaitingReplyRow {
    /** The work item. */
    readonly id: string
    /** The subject (the conversation) it concerns. */
    readonly subject_id: string | null
    /** The proposal, as stored. */
    readonly proposal: unknown
    /** The staff member it is assigned to, or null. */
    readonly assigned_staff_id: string | null
    /** When it was raised. */
    readonly created_at: string | Date
}

/** How far a customer-reply work item got: its state and the stored answer's delivery. */
export interface AnswerProgressLine {
    /** The work item id. */
    readonly id: string
    /** The work item's progress. */
    readonly work_status: string
    /** The stored answer id, absent for rejection or before performance. */
    readonly message_id: string | null
    /** The answer's delivery result. */
    readonly delivery_status: string | null
}
