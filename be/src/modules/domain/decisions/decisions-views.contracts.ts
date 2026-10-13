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
    /** Where the page starts; null for the first page. */
    readonly after?: OptionalWorkItemCursor
    /** The page size; clamped to 1..100. */
    readonly limit: number
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

/** What the decision history asks for. */
export interface DecisionHistoryQuery {
    /** Which decisions: every one, those the policy made alone, those a person made, or the rejected ones. */
    readonly kind: DecisionHistoryKind
    /** Only the decisions of this module; null for every module. */
    readonly department: string | null
    /** How many lines, clamped to 1..100. */
    readonly limit: number
}

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
    /** Who decided, by display name. */
    readonly decided_by: string
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
