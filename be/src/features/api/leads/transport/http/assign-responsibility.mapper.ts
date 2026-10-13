import type {
    AssignResponsibilityRequest,
    AssignResponsibilityResult,
} from "../../application/assign-responsibility.contracts"
import type { AssignResponsibilityRequest as AssignResponsibilityHttpRequest } from "./dto/assign-responsibility.request"
import type { AssignResponsibilityResponse } from "./dto/assign-responsibility.response"

/** Maps the HTTP request, the path id, the workspace and the request language to the command request. */
export const toAssignResponsibilityRequest = (
    workspaceId: string,
    responsibilityId: string,
    input: AssignResponsibilityHttpRequest,
    acceptLanguage: string | undefined,
): AssignResponsibilityRequest => ({
    responsibilityId,
    owner: input.owner,
    nextAction: input.nextAction,
    dueAt: input.dueAt,
    title: input.title,
    workspaceId,
    acceptLanguage,
})

/** Maps the command result to the HTTP response. */
export const toAssignResponsibilityResponse = (result: AssignResponsibilityResult): AssignResponsibilityResponse => ({
    id: result.id,
    leadId: result.leadId,
    title: result.title,
    ownerKind: result.ownerKind,
    ownerAgentId: result.ownerAgentId,
    ownerName: result.ownerName,
    nextAction: result.nextAction,
    dueAt: result.dueAt,
    status: result.status,
})
