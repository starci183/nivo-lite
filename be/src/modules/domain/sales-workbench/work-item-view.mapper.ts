import type { LeadView } from "@modules/domain/leads"
import type { StaffRecord } from "@modules/domain/staff"
import type { WorkItem } from "@modules/domain/work-items"
import type { WorkItemView } from "./work-item-view.contracts"

/** The page where the customer or department can inspect this work item. */
const hrefOfWorkItem = (item: WorkItem): string => {
    if (item.lead_id !== null) return `/leads/${item.lead_id}`
    if (item.department === "inventory") return "/agents/inventory/workbench?tab=orders"
    if (item.department === "shifts") return "/agents/shifts/workbench"
    return "/chat"
}

/** Enriches a flow item with the names that its table-owning capabilities supplied. */
export const viewOfWorkItem = (
    item: WorkItem,
    leads: ReadonlyArray<LeadView>,
    staff: ReadonlyArray<StaffRecord>,
): WorkItemView => {
    const lead = leads.find((candidate) => candidate.id === item.lead_id)
    return {
        ...item,
        lead:
            lead === undefined
                ? null
                : {
                      id: lead.id,
                      contact_name: lead.contact_name,
                      company: lead.company,
                      channel: lead.channel,
                  },
        assignedStaffName: staff.find((candidate) => candidate.id === item.assigned_staff_id)?.name ?? null,
        hasApprovalCard: item.execution_id !== null,
        href: hrefOfWorkItem(item),
    }
}
