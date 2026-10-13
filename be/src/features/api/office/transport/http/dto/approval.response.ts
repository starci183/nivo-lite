/** One approval card with the context the Office shows around it. */
export class ApprovalResponse {
    /** The card id. */
    id!: string
    /** The responsibility it belongs to. */
    responsibility_id!: string
    /** The agent that drafted it. */
    agent_id!: string | null
    /** The kind of card. */
    kind!: string
    /** The draft to approve. */
    draft!: string
    /** `pending_approval`, `approved` or `rejected`. */
    status!: string
    /** Who decided. */
    decided_by!: string | null
    /** When it was decided. */
    decided_at!: string | null
    /** When it was created. */
    created_at!: string
    /** The work item behind it. */
    work_item_id!: string | null
    /** The customer name. */
    leadName!: string | null
    /** The customer id. */
    leadId!: string | null
    /** The channel the customer talks on. */
    channel!: string
    /** The agent name. */
    agentName!: string | null
    /** What happens next. */
    nextAction!: string
    /** The staff member the work is assigned to. */
    assignedStaffId!: string | null
}
