import type { SetWorkspacePlanRequest, SetWorkspacePlanResult } from "../../application/set-workspace-plan.contracts"
import type { SetWorkspacePlanRequest as SetWorkspacePlanHttpRequest } from "./dto/set-workspace-plan.request"
import type { SetWorkspacePlanResponse } from "./dto/set-workspace-plan.response"

/** Maps the HTTP request to the application request. */
export const toSetWorkspacePlanRequest = (
    workspaceId: string,
    input: SetWorkspacePlanHttpRequest,
): SetWorkspacePlanRequest => ({
    workspaceId,
    planCode: input.planCode,
    creditsLimit: input.creditsLimit,
})

/** Maps the application result to the HTTP response. */
export const toSetWorkspacePlanResponse = (result: SetWorkspacePlanResult): SetWorkspacePlanResponse => result
