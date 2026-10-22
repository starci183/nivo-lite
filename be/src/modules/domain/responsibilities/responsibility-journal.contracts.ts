import type { Locale } from "@modules/platform/i18n"

/** Where a responsibility stands. */
export type ResponsibilityStatus = "open" | "waiting_approval" | "done"
/** Who owns a responsibility. */
export type ResponsibilityOwnerKind = "human" | "agent"

/** One thing somebody (a person or an agent) owes a customer. */
export interface ResponsibilityRecord {
    /** The id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The customer. */
    readonly lead_id: string
    /** What it is. */
    readonly title: string
    /** Person or agent. */
    readonly owner_kind: ResponsibilityOwnerKind
    /** The owning agent, when an agent owns it. */
    readonly owner_agent_id: string | null
    /** The owning member, when a person owns it. */
    readonly owner_member_id: string | null
    /** The display name of the owner. */
    readonly owner_name: string
    /** The next step. */
    readonly next_action: string
    /** When it is due. */
    readonly due_at: string | null
    /** Where it stands. */
    readonly status: ResponsibilityStatus
    /** When it was created. */
    readonly created_at: string
}

/** What creating a responsibility takes. */
export interface NewResponsibility {
    /** The customer. */
    readonly lead_id: string
    /** What it is. */
    readonly title: string
    /** The id of the owning member (a concrete person of the workspace) or of the owning agent. */
    readonly owner: string
    /** The next step. */
    readonly next_action: string
    /** When it is due; null for no date. */
    readonly due_at: string | null
}

/** A follow-up for a named person, opened on the system's behalf: its title is how an open duplicate is recognised. */
export interface NamedFollowUp {
    /** The customer. */
    readonly leadId: string
    /** What it is; an open responsibility of the customer with the same title means it is already open. */
    readonly title: string
    /** The display name of the member who owns it; a name no active member carries falls to the workspace owner. */
    readonly ownerName: string
    /** The next step. */
    readonly nextAction: string
    /** When it is due, ISO 8601. */
    readonly dueAt: string
}

/** A responsibility with the name of its customer, as the Responsibilities page lists it. */
export interface ResponsibilityListing extends ResponsibilityRecord {
    /** The customer's name. */
    readonly contact_name: string
    /** The customer's company. */
    readonly company: string | null
    /** The customer's journey stage. */
    readonly leadStage: string
}

/** Who acts and in which workspace; a work context satisfies it structurally. */
export interface ResponsibilityScope {
    /** The workspace. */
    readonly workspaceId: string
    /** The display name of the actor. */
    readonly actor: string
    /** The language of the generated text. */
    readonly locale: Locale
}

/** A responsibility, or null when the workspace has no such responsibility. */
export type OptionalResponsibility = ResponsibilityRecord | null
