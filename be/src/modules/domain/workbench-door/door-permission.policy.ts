import { isManagerRole } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import type { MemberGrant } from "@modules/domain/member-grants"

/**
 * Whether a member holds a permission a read or an action declares. Owner and manager hold every permission of every module; a staff
 * member holds it when the workspace granted it to that seat (`member_grants`, the grant of the permission as an action key).
 */
export const holdsPermission = (role: WorkspaceRole, memberId: string, grants: ReadonlyArray<MemberGrant>): boolean =>
    isManagerRole(role) || grants.some((grant) => grant.member_id === memberId)
