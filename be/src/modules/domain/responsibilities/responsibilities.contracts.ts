import type { EntityManager } from "typeorm"
import type { Locale } from "@modules/platform/i18n"

/** One step of a lead journey as a person or an agent owns it. */
export interface ResponsibilityResult {
    /** The responsibility id. */
    readonly id: string
    /** The lead it belongs to. */
    readonly leadId: string
    /** The title of the step. */
    readonly title: string
    /** `human` or `agent`. */
    readonly ownerKind: string
    /** The agent that owns it, when it is an agent. */
    readonly ownerAgentId: string | null
    /** The member that owns it, when it is a person. */
    readonly ownerMemberId: string | null
    /** The name shown as owner. */
    readonly ownerName: string
    /** What happens next. */
    readonly nextAction: string
    /** When it is due, ISO 8601. */
    readonly dueAt: string | null
    /** `open`, `waiting_approval` or `done`. */
    readonly status: string
}

/** What adding the next responsibility of a lead takes. */
export interface AddResponsibilityParams {
    /** The workspace the lead belongs to. */
    readonly workspaceId: string
    /** The lead the step belongs to. */
    readonly leadId: string
    /** The title of the step. */
    readonly title: string
    /** The id of the member (a concrete person of the workspace) or of the agent that owns the step. */
    readonly owner: string
    /** What happens next. */
    readonly nextAction: string
    /** When it is due, ISO 8601; null for no date. */
    readonly dueAt: string | null
    /** The signed-in caller; the workspace members service proves the membership and names the actor. */
    readonly userId: string
    /** The `Accept-Language` header of the request; the evidence line is written in the language it names. */
    readonly acceptLanguage: string | undefined
}

/** What reassigning an existing responsibility takes. */
export interface AssignResponsibilityParams {
    /** The workspace the responsibility belongs to. */
    readonly workspaceId: string
    /** The responsibility to change. */
    readonly responsibilityId: string
    /** The id of the member (a concrete person of the workspace) or of the agent that owns the step. */
    readonly owner: string
    /** What happens next. */
    readonly nextAction: string
    /** When it is due, ISO 8601; null for no date. */
    readonly dueAt: string | null
    /** A new title, when the person changes it; null keeps the current one. */
    readonly title: string | null
    /** The signed-in caller; the workspace members service proves the membership and names the actor. */
    readonly userId: string
    /** The `Accept-Language` header of the request; the evidence line is written in the language it names. */
    readonly acceptLanguage: string | undefined
}

/** What handing a won deal to Accounting takes; it joins the transaction of the caller. */
export interface HandToAccountingParams {
    /** The workspace the lead belongs to. */
    readonly workspaceId: string
    /** The won lead. */
    readonly leadId: string
    /** The customer name the invoice is prepared for. */
    readonly contactName: string
    /** The language the lines are written in. */
    readonly locale: Locale
    /** The transaction of the caller. */
    readonly manager: EntityManager
}
