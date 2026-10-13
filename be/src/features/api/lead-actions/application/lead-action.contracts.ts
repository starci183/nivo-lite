import type { LeadActionInput } from "@modules/domain/lead-actions"

/** Workspace context and action arguments for a queued lead operation. */
export interface LeadActionRequest {
    /** The workspace selected by the authenticated caller. */
    readonly workspaceId: string
    /** The bounded arguments of the requested lead action. */
    readonly input: LeadActionInput
    /** The caller's preferred language for generated lead evidence. */
    readonly acceptLanguage: string | undefined
}
