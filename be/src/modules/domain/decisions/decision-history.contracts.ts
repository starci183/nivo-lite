import type { ReasonCode } from "@modules/domain/work-items"

/** One decision in a customer's flow or the recent human Sales history. */
export interface DecisionRecord {
    /** The decision id. */
    readonly id: string
    /** The item that was decided. */
    readonly work_item_id: string | null
    /** The customer. */
    readonly lead_id: string | null
    /** The customer name, when the customer still exists. */
    readonly leadName: string | null
    /** The department. */
    readonly department: string
    /** The action key. */
    readonly action: string
    /** Who made the decision. */
    readonly decided_by: string
    /** Policy, owner or staff. */
    readonly decider_kind: string
    /** The decision outcome. */
    readonly outcome: string
    /** Why the decision was made. */
    readonly reason: ReasonCode | null
    /** The person's note. */
    readonly note: string | null
    /** When the decision was recorded. */
    readonly created_at: string
}

/** A bounded decision history request, scoped by the composing service. */
export interface DecisionHistoryQuery {
    /** Only this customer's history, when set. */
    readonly leadId?: string
    /** Only owner/staff decisions of this department, when set. */
    readonly humanDepartment?: string
    /** The maximum number of rows. */
    readonly limit: number
    /** Oldest first for the customer's journey. */
    readonly oldestFirst?: boolean
}
