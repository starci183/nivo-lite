import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the workspace-members capability. */
export enum WorkspaceMembersErrorCode {
    /** The door needs a workspace and the request names none (or a malformed one). */
    WorkspaceRequired = "WORKSPACE_MEMBERS_WORKSPACE_REQUIRED",
    /** The caller is not an active member of the workspace they named. */
    NotMember = "WORKSPACE_MEMBERS_NOT_MEMBER",
    /** The caller is a member but their role does not allow this operation. */
    RoleForbidden = "WORKSPACE_MEMBERS_ROLE_FORBIDDEN",
    /** The member a command names is not in the workspace. */
    MemberNotFound = "WORKSPACE_MEMBERS_MEMBER_NOT_FOUND",
    /** The caller may not change this member (an owner row, or granting the owner role, is for owners). */
    ChangeNotAllowed = "WORKSPACE_MEMBERS_CHANGE_NOT_ALLOWED",
    /** Disabling or removing one's own account is never allowed. */
    SelfForbidden = "WORKSPACE_MEMBERS_SELF_FORBIDDEN",
    /** The change would leave the workspace without an active owner. */
    LastOwner = "WORKSPACE_MEMBERS_LAST_OWNER",
}

/** How each workspace-members code travels. */
export const WORKSPACE_MEMBERS_ERROR_KINDS: Record<WorkspaceMembersErrorCode, ErrorKind> = {
    [WorkspaceMembersErrorCode.WorkspaceRequired]: "invalid",
    [WorkspaceMembersErrorCode.NotMember]: "forbidden",
    [WorkspaceMembersErrorCode.RoleForbidden]: "forbidden",
    [WorkspaceMembersErrorCode.MemberNotFound]: "not-found",
    [WorkspaceMembersErrorCode.ChangeNotAllowed]: "forbidden",
    [WorkspaceMembersErrorCode.SelfForbidden]: "invalid",
    [WorkspaceMembersErrorCode.LastOwner]: "conflict",
}

/** The one error class of the workspace-members capability. */
export class WorkspaceMembersError extends DomainError<WorkspaceMembersErrorCode> {}
