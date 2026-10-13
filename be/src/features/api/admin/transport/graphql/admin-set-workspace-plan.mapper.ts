import type { SetWorkspacePlanRequest, SetWorkspacePlanResult } from "../../application/set-workspace-plan.contracts"
import type { AdminSetWorkspacePlanInput } from "./dto/admin-set-workspace-plan.input"
import type { AdminPlanSetType } from "./dto/admin-plan-set.type"

/** Maps the GraphQL input to the application request. */
export const toAdminSetWorkspacePlanRequest = (input: AdminSetWorkspacePlanInput): SetWorkspacePlanRequest => ({
    workspaceId: input.workspaceId,
    planCode: input.planCode,
    creditsLimit: input.creditsLimit,
})

/** Maps the application result to the GraphQL type. */
export const toAdminPlanSetType = (result: SetWorkspacePlanResult): AdminPlanSetType => ({
    planCode: result.planCode,
    creditsLimit: result.creditsLimit,
})
