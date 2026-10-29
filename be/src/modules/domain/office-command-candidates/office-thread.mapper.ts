import type { ApprovalView } from "./office-command-candidates.contracts"
import type { ApprovalLine } from "./office-reads.contracts"

const leadNameOf = (row: ApprovalLine): string | null => {
    if (row.contact_name === null) return null
    return row.company === null || row.company === "" ? row.contact_name : `${row.contact_name} - ${row.company}`
}

/** An execution row as the approval card reads it: the customer as one label, the agent falling back to the owner. */
export const toApprovalView = (row: ApprovalLine): ApprovalView => ({
    id: row.id,
    responsibility_id: row.responsibility_id,
    agent_id: row.agent_id,
    kind: row.kind,
    draft: row.draft,
    status: row.status,
    decided_by: row.decided_by,
    decided_at: row.decided_at,
    created_at: row.created_at,
    work_item_id: row.work_item_id,
    leadName: leadNameOf(row),
    leadId: row.lead_id,
    channel: row.channel ?? "",
    agentName: row.agent_name ?? row.owner_name,
    nextAction: row.next_action ?? "",
    assignedStaffId: row.assigned_staff_id,
})
