/** The operating-flow contract the console reads: work items, decisions, orders and invoices as the back end returns them. */
/** How an authority rule lets an action run: on its own, after asking, or never. */
export type FlowRuleMode = "auto" | "ask" | "never"
/** Why a piece of work stopped for a person. */
export type ReasonCode = "routine" | "missing_data" | "over_authority" | "unclear_outcome" | "not_allowed"
/** Where a piece of work stands. */
export type FlowWorkStatus = "queued" | "done" | "waiting_decision" | "rejected" | "failed"
/** How far the proof of a finished piece of work has come. */
type FlowEvidenceState = "pending" | "captured" | "reviewed" | "verified" | "customer_confirmed"
/** A staff row of the workspace. */
export type FlowStaff = {
    id: string
    workspace_id: string
    name: string
    role: string
    email: string | null
    active: boolean
    created_at: string
}
/** What an agent proposes for a piece of work. */
export type Proposal = {
    summary: string
    draft?: string
    amount_vnd?: number | null
    fields: Record<string, string | number | null>
    confidence?: number
    outcome?: "clear" | "unclear"
    candidates?: Array<{ id: string; label: string; amount_vnd: number }>
}
/** One piece of work a module performs. */
export type WorkItem = {
    id: string
    workspace_id: string
    /** The module that performs the work (a catalog module key). */
    department: string
    /** The action it performs (a catalog action key). */
    action: string
    subject_type: "lead" | "order" | "invoice" | "transaction" | "conversation" | "inbound" | "purchase_order" | "stock"
    subject_id: string | null
    lead_id: string | null
    inbound_event_id: string | null
    parent_id: string | null
    /** the command chain this item belongs to (its root's id) and the hops from the root: see agent-commands.ts */
    chain_id: string | null
    depth: number
    status: FlowWorkStatus
    decided_path: "auto" | "human" | null
    reason: ReasonCode | null
    reasons: string[]
    missing_fields: string[]
    proposal: Proposal
    result: { summary: string; href?: string } | null
    error: string | null
    evidence_state: FlowEvidenceState
    assigned_staff_id: string | null
    execution_id: string | null
    created_at: string
    updated_at: string
    completed_at: string | null
    /** the agent instance that handles it (one branch's Chatbot); set by the database (resolve_installation) when the writer does not say */
    installation_id?: string | null
}
/** A piece of work with the lead, the assignee and its link resolved for display. */
export type FlowWorkItemView = WorkItem & {
    lead: { id: string; contact_name: string; company: string; channel: string } | null
    assignedStaffName: string | null
    /** true when a legacy execution approval card already renders this item (Office must not render it twice) */
    hasApprovalCard: boolean
    href: string
    /** who made the latest decision on this item: only set by `listWorkItems({ withDecider: true })` (embedded in the same request) */
    decidedBy?: string | null
}
/** The edits a person makes before approving a piece of work. */
export type FlowWorkEdits = {
    draft?: string
    amount_vnd?: number | null
    fields?: Record<string, string | number | null>
    candidateId?: string
}
