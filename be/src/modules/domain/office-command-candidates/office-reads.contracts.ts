/** One execution with the context its approval card shows, as the approval queries select it. */
export interface ApprovalLine {
    readonly id: string
    readonly responsibility_id: string
    readonly agent_id: string | null
    readonly kind: string
    readonly draft: string
    readonly status: "pending_approval" | "approved" | "rejected"
    readonly decided_by: string | null
    readonly work_item_id: string | null
    readonly decided_at: string | null
    readonly created_at: string
    readonly lead_id: string | null
    readonly next_action: string | null
    readonly owner_name: string | null
    readonly contact_name: string | null
    readonly company: string | null
    readonly channel: string | null
    readonly agent_name: string | null
    readonly assigned_staff_id: string | null
}
