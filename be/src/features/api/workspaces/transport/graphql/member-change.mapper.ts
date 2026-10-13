import type { ChangeMemberRoleRequest } from "../../application/change-member-role.contracts"
import type { RemoveMemberRequest } from "../../application/remove-member.contracts"
import type { SetMemberStatusRequest } from "../../application/set-member-status.contracts"
import type { ChangeMemberRoleInput } from "./dto/change-member-role.input"
import type { MemberRefInput } from "./dto/member-ref.input"
import type { SetMemberStatusInput } from "./dto/set-member-status.input"

/** Maps the GraphQL input to the role-change request of the workspace it names. */
export const toChangeMemberRoleRequest = (
    workspaceId: string,
    input: ChangeMemberRoleInput,
): ChangeMemberRoleRequest => ({
    workspaceId,
    userId: input.userId,
    role: input.role,
})

/** Maps the GraphQL input to the enable or disable request of the workspace it names. */
export const toSetMemberStatusRequest = (workspaceId: string, input: SetMemberStatusInput): SetMemberStatusRequest => ({
    workspaceId,
    userId: input.userId,
    status: input.status,
})

/** Maps the GraphQL input to the removal request of the workspace it names. */
export const toRemoveMemberRequest = (workspaceId: string, input: MemberRefInput): RemoveMemberRequest => ({
    workspaceId,
    userId: input.userId,
})
