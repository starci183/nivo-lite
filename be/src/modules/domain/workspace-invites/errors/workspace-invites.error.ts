import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the workspace-invites capability. */
export enum WorkspaceInvitesErrorCode {
    /** The invited address is not an email address. */
    EmailInvalid = "WORKSPACE_INVITES_EMAIL_INVALID",
    /** The invited address already belongs to a member. */
    AlreadyMember = "WORKSPACE_INVITES_ALREADY_MEMBER",
    /** The staff row is already linked to a member or a pending invitation. */
    StaffTaken = "WORKSPACE_INVITES_STAFF_TAKEN",
    /** No pending invitation has that id in this workspace. */
    NotFound = "WORKSPACE_INVITES_NOT_FOUND",
    /** No invitation matches the token. */
    Invalid = "WORKSPACE_INVITES_INVALID",
    /** The invitation was revoked. */
    Revoked = "WORKSPACE_INVITES_REVOKED",
    /** The invitation was already accepted. */
    Used = "WORKSPACE_INVITES_USED",
    /** The invitation expired. */
    Expired = "WORKSPACE_INVITES_EXPIRED",
    /** The signed-in address is not the invited one. */
    EmailMismatch = "WORKSPACE_INVITES_EMAIL_MISMATCH",
}

/** How each workspace-invites code travels. */
export const WORKSPACE_INVITES_ERROR_KINDS: Record<WorkspaceInvitesErrorCode, ErrorKind> = {
    [WorkspaceInvitesErrorCode.EmailInvalid]: "invalid",
    [WorkspaceInvitesErrorCode.AlreadyMember]: "conflict",
    [WorkspaceInvitesErrorCode.StaffTaken]: "conflict",
    [WorkspaceInvitesErrorCode.NotFound]: "not-found",
    [WorkspaceInvitesErrorCode.Invalid]: "not-found",
    [WorkspaceInvitesErrorCode.Revoked]: "conflict",
    [WorkspaceInvitesErrorCode.Used]: "conflict",
    [WorkspaceInvitesErrorCode.Expired]: "conflict",
    [WorkspaceInvitesErrorCode.EmailMismatch]: "forbidden",
}

/** The one error class of the workspace-invites capability. */
export class WorkspaceInvitesError extends DomainError<WorkspaceInvitesErrorCode> {}
