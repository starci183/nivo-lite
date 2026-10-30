import type { ReasonCode } from "@modules/domain/work-items"
import type { DecisionHistoryKind } from "./decisions-views.contracts"

/** One decision in a customer's flow or the recent human Sales history. */
export interface LeadDecisionRecord {
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
    /** Who made the decision: the member's current display name, else the name the line was written with. */
    readonly decided_by: string
    /** The member who made it; null for a policy decision and for lines written before members were named. */
    readonly decidedByMemberId: string | null
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

/** Which decisions the history lists, how many and of which module. */
export interface DecisionHistoryRequest {
    /** Every decision, those the policy made alone, those a person made, or the rejected ones. */
    readonly kind: DecisionHistoryKind
    /** Only the decisions of this module; null for every module. */
    readonly department: string | null
    /** How many lines, clamped to 1..100. */
    readonly limit: number
}

/** What the decision log is narrowed to; a null filter does not narrow. */
export interface DecisionLogFilter {
    /** The deciders to keep (`policy`, `owner`, `staff`). */
    readonly deciders: ReadonlyArray<string> | null
    /** The outcome to keep. */
    readonly outcome: string | null
    /** The module to keep. */
    readonly department: string | null
    /** The most lines. */
    readonly limit: number
}

/** A chain step as the history names its thread. */
export interface HistoryStepThread {
    /** The step id. */
    readonly id: string
    /** The thread the step belongs to. */
    readonly threadId: string
}

/** A hand-off or assignment a member completed, as the history lists it. */
export interface HistoryCompletedTask {
    /** The step id. */
    readonly id: string
    /** The thread the step belongs to. */
    readonly threadId: string
    /** member or agent. */
    readonly actorKind: string
    /** The actor id. */
    readonly actorId: string
    /** The step title. */
    readonly action: string
    /** The authority rule, or null. */
    readonly rule: string | null
    /** The member who completed it. */
    readonly decidedBy: string
    /** When it finished, else when it started. */
    readonly at: Date
}

/** The customer a thread is about, as the history reads it. */
export interface HistoryThreadLead {
    /** The thread id. */
    readonly id: string
    /** The customer, or null when the thread is about none. */
    readonly leadId: string | null
}
