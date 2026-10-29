import type { WorkItem } from "./decisions.contracts"

/** public.work_items as the Decisions page reads it: timestamps arrive as ISO text, the CHECK columns narrowed. */
export interface WorkItemViewRow extends WorkItem {
    /** The creation instant at full precision: the keyset cursor of the next page. */
    cursor_at: string
}

/** The customer of a waiting accounting work item. */
export interface AccountingWaitingLeadRow {
    /** The customer id. */
    readonly id: string
    /** The contact's name. */
    readonly contact_name: string
    /** The company. */
    readonly company: string
    /** The customer channel. */
    readonly channel: string
}

/** A waiting accounting item with its customer and assigned staff member. */
export interface AccountingWaitingWorkRow extends WorkItem {
    /** The customer, when it still exists in this workspace. */
    readonly lead: AccountingWaitingLeadRow | null
    /** The assigned staff member's name, when there is one. */
    readonly assigned_staff_name: string | null
}
