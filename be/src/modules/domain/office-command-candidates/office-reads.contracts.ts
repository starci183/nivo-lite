/** One execution with the context its approval card shows, as the approval queries select it. */
export interface ApprovalLine {
    /** The execution id. */
    readonly id: string
    /** The responsibility the execution runs under. */
    readonly responsibility_id: string
    /** The agent that drafted it, when one did. */
    readonly agent_id: string | null
    /** The kind of execution. */
    readonly kind: string
    /** The drafted text awaiting approval. */
    readonly draft: string
    /** Where the approval stands. */
    readonly status: "pending_approval" | "approved" | "rejected"
    /** Who approved or rejected it, once decided. */
    readonly decided_by: string | null
    /** The work item it belongs to, when any. */
    readonly work_item_id: string | null
    /** When it was decided, ISO 8601; null while pending. */
    readonly decided_at: string | null
    /** When it was created, ISO 8601. */
    readonly created_at: string
    /** The customer it concerns, when any. */
    readonly lead_id: string | null
    /** The next action recorded on the customer. */
    readonly next_action: string | null
    /** The name of the customer's owner. */
    readonly owner_name: string | null
    /** The customer's contact name. */
    readonly contact_name: string | null
    /** The customer's company. */
    readonly company: string | null
    /** The channel the customer came through. */
    readonly channel: string | null
    /** The drafting agent's display name. */
    readonly agent_name: string | null
    /** The staff member the customer is assigned to. */
    readonly assigned_staff_id: string | null
}
