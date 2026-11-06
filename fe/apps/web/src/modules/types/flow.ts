/** The operating-flow contract the console reads: work items, decisions, orders and invoices as the back end returns them. */
/** How an authority rule lets an action run: on its own, after asking, or never. */
export type FlowRuleMode = "auto" | "ask" | "never"
/** Why a piece of work stopped for a person. */
type ReasonCode = "routine" | "missing_data" | "over_authority" | "unclear_outcome" | "not_allowed"
/** Where a piece of work stands. */
type FlowWorkStatus = "queued" | "done" | "waiting_decision" | "rejected" | "failed"
/** How far the proof of a finished piece of work has come. */
type FlowEvidenceState = "pending" | "captured" | "reviewed" | "verified" | "customer_confirmed"
/** What an agent proposes for a piece of work. */
type Proposal = {
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
/** The edits a person makes before approving a piece of work. */
export type FlowWorkEdits = {
    draft?: string
    amount_vnd?: number | null
    fields?: Record<string, string | number | null>
    candidateId?: string
}
