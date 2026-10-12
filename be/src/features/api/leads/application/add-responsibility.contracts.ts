/** What adding the next responsibility of a lead takes. */
export interface AddResponsibilityRequest {
    /** The lead the step belongs to. */
    readonly leadId: string
    /** The title of the step. */
    readonly title: string
    /** `human` for the signed-in person, else the id of an agent of the workspace. */
    readonly owner: string
    /** What happens next. */
    readonly nextAction: string
    /** When it is due, ISO 8601; null for no date. */
    readonly dueAt: string | null
    /** The workspace the caller acts in, named in X-Workspace-Id; the domain service proves the caller membership in it. */
    readonly workspaceId: string
    /** The `Accept-Language` header of the request; the evidence lines use the language it names. */
    readonly acceptLanguage: string | undefined
}

/** What adding a responsibility answers: the step as written. */
export interface AddResponsibilityResult {
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
    /** The name shown as owner. */
    readonly ownerName: string
    /** What happens next. */
    readonly nextAction: string
    /** When it is due, ISO 8601. */
    readonly dueAt: string | null
    /** `open`, `waiting_approval` or `done`. */
    readonly status: string
}
