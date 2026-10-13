/** One execution with the context of its responsibility, customer, agent and work item. */
export interface ApprovalRow {
    /** The execution id. */
    id: string
    /** The responsibility it belongs to. */
    responsibility_id: string
    /** The agent that drafted it. */
    agent_id: string | null
    /** What kind of execution it is. */
    kind: string
    /** The draft to approve. */
    draft: string
    /** Constrained by a CHECK in the table. */
    status: "pending_approval" | "approved" | "rejected"
    /** Who decided it. */
    decided_by: string | null
    /** The work item behind it. */
    work_item_id: string | null
    /** When it was decided, ISO 8601. */
    decided_at: string | null
    /** When it was created, ISO 8601. */
    created_at: string
    /** The customer of the responsibility. */
    lead_id: string | null
    /** The responsibility's next action. */
    next_action: string | null
    /** The responsibility's owner. */
    owner_name: string | null
    /** The customer's name. */
    contact_name: string | null
    /** The customer's company. */
    company: string | null
    /** The customer's channel. */
    channel: string | null
    /** The agent's name. */
    agent_name: string | null
    /** The staff member the work item is assigned to. */
    assigned_staff_id: string | null
}
