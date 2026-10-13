import type { AddResponsibilityRequest, AddResponsibilityResult } from "../../application/add-responsibility.contracts"
import type { AddResponsibilityInput } from "./dto/add-responsibility.input"
import type { LeadResponsibilityType } from "./dto/lead-responsibility.type"

/** Maps the input and request context to a new responsibility command. */
export const toAddResponsibilityRequest = (
    workspaceId: string,
    input: AddResponsibilityInput,
    acceptLanguage: string,
): AddResponsibilityRequest => ({
    leadId: input.leadId,
    title: input.title,
    owner: input.owner,
    nextAction: input.nextAction,
    dueAt: input.dueAt,
    workspaceId,
    acceptLanguage,
})

/** Maps the added responsibility to the GraphQL type. */
export const toAddResponsibilityType = (result: AddResponsibilityResult): LeadResponsibilityType => ({ ...result })
