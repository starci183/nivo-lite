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
}

/** How each workspace-members code travels. */
export const WORKSPACE_MEMBERS_ERROR_KINDS: Record<WorkspaceMembersErrorCode, ErrorKind> = {
    [WorkspaceMembersErrorCode.WorkspaceRequired]: "invalid",
    [WorkspaceMembersErrorCode.NotMember]: "forbidden",
    [WorkspaceMembersErrorCode.RoleForbidden]: "forbidden",
}

/** The one error class of the workspace-members capability. */
export class WorkspaceMembersError extends DomainError<WorkspaceMembersErrorCode> {}
