import type { Authority, AuthorityRule, RuleMode, WorkItem, WorkStatus } from "./decisions.contracts"
import type { ResponsibilityRecord } from "./decisions.contracts"

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
    readonly after: OptionalWorkItemCursor
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

/** The whole authority sheet the Authority page edits. */
export interface AuthorityProfile extends Authority {
    /** The monthly revenue goal, VND. */
    readonly goal_revenue_vnd: number | null
    /** The new-customer goal. */
    readonly goal_new_customers: number | null
    /** The first-reply goal, minutes. */
    readonly goal_first_reply_minutes: number | null
    /** Free note on the goals. */
    readonly goal_note: string
    /** Who saved it last. */
    readonly updated_by: string | null
    /** When it was saved last. */
    readonly updated_at: string
}

/** The authority sheet, or null before the workspace has one. */
export type OptionalAuthorityProfile = AuthorityProfile | null

/** A stored rule with its workspace and note, as the Authority page lists it. */
export interface AuthorityRuleRecord extends AuthorityRule {
    /** The workspace. */
    readonly workspace_id: string
    /** A note on the rule. */
    readonly note: string
    /** When it was saved last. */
    readonly updated_at: string
}

/** What the Authority page reads: the sheet and every stored rule. */
export interface AuthoritySheet {
    /** The goals and house rules, null before the workspace has any. */
    readonly profile: OptionalAuthorityProfile
    /** Every stored rule. */
    readonly rules: ReadonlyArray<AuthorityRuleRecord>
}

/** The fields of the authority sheet a manager changes; omitted fields stay as they are. */
export interface AuthorityPatch {
    /** The business policies. */
    readonly policies?: string
    /** How replies are written. */
    readonly reply_style?: string
    /** The brand voice. */
    readonly brand_voice?: string
    /** What the agent must always ask about first. */
    readonly limits_note?: string
    /** The monthly revenue goal, VND. */
    readonly goal_revenue_vnd?: number | null
    /** The new-customer goal. */
    readonly goal_new_customers?: number | null
    /** The first-reply goal, minutes. */
    readonly goal_first_reply_minutes?: number | null
    /** Free note on the goals. */
    readonly goal_note?: string
}

/** One rule a manager saves. */
export interface RuleChange {
    /** The action key; its module is the one the registry gives. */
    readonly action: string
    /** The mode. */
    readonly mode: RuleMode
    /** The action runs alone strictly below this amount, VND; null means no limit. */
    readonly limit_vnd: number | null
    /** Fields that must be present. */
    readonly required_fields: ReadonlyArray<string>
}

/** What creating a responsibility takes. */
export interface NewResponsibility {
    /** The customer. */
    readonly lead_id: string
    /** What it is. */
    readonly title: string
    /** `human`, or the id of the owning agent. */
    readonly owner: string
    /** The next step. */
    readonly next_action: string
    /** When it is due; null for no date. */
    readonly due_at: string | null
}

/** A responsibility with the name of its customer, as the Responsibilities page lists it. */
export interface ResponsibilityListing extends ResponsibilityRecord {
    /** The customer's name. */
    readonly contact_name: string
}

/** An id, or null when there is none. */
export type OptionalId = string | null

/** A number that may be absent. */
export type OptionalNumber = number | null | undefined

/** A text that may be absent. */
export type OptionalOperatingMode = string | null | undefined

/** A JSON value as a jsonb column answers it. */
export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue | undefined } | Array<JsonValue>
