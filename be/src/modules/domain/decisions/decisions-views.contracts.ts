import type { OptionalAuthorityProfile } from "@modules/domain/authority"
import type { AuthorityRuleRecord } from "@modules/domain/authority-rules"
import type { WorkItem, WorkStatus } from "./decisions.contracts"

/** The position after which the next page of work items starts (keyset on created_at, id). */
export interface WorkItemCursor {
    /** The `created_at` of the last item of the previous page. */
    readonly createdAt: string
    /** The id of the last item of the previous page. */
    readonly id: string
}

/** A cursor, or null for the first page. */
export type OptionalWorkItemCursor = WorkItemCursor | null

/** What a work-item listing asks for. */
export interface ListWorkItemsQuery {
    /** Only these statuses; an empty list means every status. */
    readonly statuses: ReadonlyArray<WorkStatus>
    /** Only this action; null means every action. */
    readonly action: string | null | undefined
    /** Where the page starts; null for the first page. */
    readonly after?: OptionalWorkItemCursor | undefined
    /** The page size; clamped to 1..100. */
    readonly limit: number
}

/** The bank credit, or the customer's claim, behind a waiting reconciliation. */
export interface ReconcilePayment {
    /** The money, VND. */
    readonly amount_vnd: number | null
    /** Who paid, or who said they paid. */
    readonly payer: string | null
    /** The transfer content, or the claim. */
    readonly reference: string | null
    /** When it happened, ISO 8601. */
    readonly occurred_at: string | null
}

/** One invoice a payment may settle, with the customer, the order and both statuses. */
export interface ReconcileCandidate {
    /** The invoice id. */
    readonly id: string
    /** The invoice number. */
    readonly invoice_no: string
    /** The amount, VND. */
    readonly amount_vnd: number
    /** The invoice status. */
    readonly status: string
    /** The customer's name. */
    readonly customer: string | null
    /** The customer's company. */
    readonly company: string | null
    /** The order number. */
    readonly order_no: string | null
    /** What the order contains. */
    readonly order_items: string | null
    /** The order status. */
    readonly order_status: string | null
    /** When the invoice was issued, ISO 8601. */
    readonly issued_at: string | null
    /** When the invoice is due, ISO 8601. */
    readonly due_at: string | null
}

/** What the owner checks before matching a payment to an invoice. */
export interface ReconcileDetails {
    /** The payment or the claim. */
    readonly payment: ReconcilePayment
    /** The invoices NIVO proposes, in the proposal's order. */
    readonly candidates: ReadonlyArray<ReconcileCandidate>
}

/** One page of work items, newest first. */
export interface WorkItemPage {
    /** The items of the page. */
    readonly items: ReadonlyArray<WorkItem>
    /** The cursor of the next page; null on the last one. */
    readonly next: OptionalWorkItemCursor
}

/** A number that may be absent. */
export type OptionalNumber = number | null | undefined

/** A JSON value as a jsonb column answers it. */
export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue | undefined } | Array<JsonValue>

/** What the Authority page reads: the sheet and every stored rule. */
export interface AuthoritySheet {
    /** The goals and house rules, null before the workspace has any. */
    readonly profile: OptionalAuthorityProfile
    /** Every stored rule. */
    readonly rules: ReadonlyArray<AuthorityRuleRecord>
}

/** Which decisions the history lists. */
export type DecisionHistoryKind = "all" | "policy" | "human" | "rejected"

/** One line of the decision log. */
export interface DecisionRecord {
    /** The id. */
    readonly id: string
    /** The work item the decision was about. */
    readonly work_item_id: string | null
    /** The customer it was about. */
    readonly lead_id: string | null
    /** The customer name, when there is one. */
    readonly leadName: string | null
    /** The module. */
    readonly department: string
    /** The action key. */
    readonly action: string
    /** Who decided, by the member's current display name. */
    readonly decided_by: string
    /** The member who decided; null for a policy decision and for lines written before members were named. */
    readonly decidedByMemberId: string | null
    /** `policy`, `owner` or `staff`. */
    readonly decider_kind: string
    /** `auto_done`, `approved`, `edited` or `rejected`. */
    readonly outcome: string
    /** Why the gate asked, when it did. */
    readonly reason: string | null
    /** A note from the decider. */
    readonly note: string
    /** When it was decided, ISO 8601. */
    readonly created_at: string
}
