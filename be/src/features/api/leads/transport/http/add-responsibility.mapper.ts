import type { AddResponsibilityRequest, AddResponsibilityResult } from "../../application/add-responsibility.contracts"
import type { AddResponsibilityRequest as AddResponsibilityHttpRequest } from "./dto/add-responsibility.request"
import type { AddResponsibilityResponse } from "./dto/add-responsibility.response"

/** Maps the HTTP request, the path id, the workspace and the request language to the command request. */
export const toAddResponsibilityRequest = (
    workspaceId: string,
    leadId: string,
    input: AddResponsibilityHttpRequest,
    acceptLanguage: string | undefined,
): AddResponsibilityRequest => ({
    leadId,
    title: input.title,
    owner: input.owner,
    nextAction: input.nextAction,
    dueAt: input.dueAt,
    workspaceId,
    acceptLanguage,
})

/** Maps the command result to the HTTP response. */
export const toAddResponsibilityResponse = (result: AddResponsibilityResult): AddResponsibilityResponse => ({
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
