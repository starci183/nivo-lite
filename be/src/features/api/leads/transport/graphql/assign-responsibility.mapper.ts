import type {
    AssignResponsibilityRequest,
    AssignResponsibilityResult,
} from "../../application/assign-responsibility.contracts"
import type { AssignResponsibilityInput } from "./dto/assign-responsibility.input"
import type { LeadResponsibilityType } from "./dto/lead-responsibility.type"

/** Maps the input and request context to a reassignment command. */
export const toAssignResponsibilityRequest = (
    workspaceId: string,
    input: AssignResponsibilityInput,
    acceptLanguage: string,
): AssignResponsibilityRequest => ({
    responsibilityId: input.responsibilityId,
    owner: input.owner,
    nextAction: input.nextAction,
    dueAt: input.dueAt,
    title: input.title,
    workspaceId,
    acceptLanguage,
})

/** Maps the reassigned responsibility to the GraphQL type. */
export const toAssignResponsibilityType = (result: AssignResponsibilityResult): LeadResponsibilityType => ({
    ...result,
})
