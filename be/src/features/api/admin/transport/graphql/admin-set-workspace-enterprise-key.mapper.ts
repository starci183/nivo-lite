import type {
    SetWorkspaceEnterpriseKeyRequest,
    SetWorkspaceEnterpriseKeyResult,
} from "../../application/set-workspace-enterprise-key.contracts"
import type { AdminEnterpriseKeySetType } from "./dto/admin-enterprise-key-set.type"
import type { AdminSetWorkspaceEnterpriseKeyInput } from "./dto/admin-set-workspace-enterprise-key.input"

/** Maps the GraphQL input to the application request. */
export const toAdminSetWorkspaceEnterpriseKeyRequest = (
    input: AdminSetWorkspaceEnterpriseKeyInput,
): SetWorkspaceEnterpriseKeyRequest => ({
    workspaceId: input.workspaceId,
    enterpriseKey: input.enterpriseKey,
})

/** Maps the application result to the GraphQL type. */
export const toAdminEnterpriseKeySetType = (result: SetWorkspaceEnterpriseKeyResult): AdminEnterpriseKeySetType => ({
    enterpriseKey: result.enterpriseKey,
})
