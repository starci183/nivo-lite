import type { LeadView } from "@modules/domain/leads"
import type { WorkItem } from "@modules/domain/work-items"

/** The flow's work item with its customer, assigned person and navigation target. */
export interface WorkItemView extends WorkItem {
    /** The linked customer, when still present. */
    readonly lead: Pick<LeadView, "id" | "contact_name" | "company" | "channel"> | null
    /** The assigned person's name. */
    readonly assignedStaffName: string | null
    /** Whether the execution already supplies an approval card. */
    readonly hasApprovalCard: boolean
    /** The page that contains the evidence. */
    readonly href: string
}
