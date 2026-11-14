import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the workspaces capability. */
export enum WorkspacesErrorCode {
    /** Creating a free workspace is switched off in this environment. */
    SignupDisabled = "WORKSPACES_SIGNUP_DISABLED",
    /** No workspace has that id. */
    NotFound = "WORKSPACES_NOT_FOUND",
    /** The plan does not exist or is retired. */
    PlanUnknown = "WORKSPACES_PLAN_UNKNOWN",
    /** No workspace is to be kept: a prune would delete everything. */
    NothingToKeep = "WORKSPACES_NOTHING_TO_KEEP",
    /** A workspace to keep does not exist: the ids are wrong, so nothing is deleted. */
    KeepNotFound = "WORKSPACES_KEEP_NOT_FOUND",
    /** Some workspaces could not be deleted. */
    DeleteFailed = "WORKSPACES_DELETE_FAILED",
    /** An explicit workspace name is missing or exceeds the supported bound. */
    NameInvalid = "WORKSPACES_NAME_INVALID",
    /** More than one owned active workspace has the requested exact name. */
    NameAmbiguous = "WORKSPACES_NAME_AMBIGUOUS",
    /** The named workspace or owner seat is inactive and must be restored explicitly. */
    NameUnavailable = "WORKSPACES_NAME_UNAVAILABLE",
    /** The name typed to confirm a deletion is not the workspace's name. */
    DeleteConfirmMismatch = "WORKSPACES_DELETE_CONFIRM_MISMATCH",
    /** The deleted workspace is past its restore window. */
    RestoreExpired = "WORKSPACES_RESTORE_EXPIRED",
    /** The enterprise identifier is not a lowercase slug of at most 40 characters. */
    EnterpriseKeyInvalid = "WORKSPACES_ENTERPRISE_KEY_INVALID",
    /** Another workspace already holds the enterprise identifier. */
    EnterpriseKeyTaken = "WORKSPACES_ENTERPRISE_KEY_TAKEN",
    /** The time zone is not an IANA name the platform knows. */
    TimeZoneInvalid = "WORKSPACES_TIME_ZONE_INVALID",
    /** A theme member is out of its range or not in its list. */
    ThemeInvalid = "WORKSPACES_THEME_INVALID",
}

/** How each workspaces code travels. */
export const WORKSPACES_ERROR_KINDS: Record<WorkspacesErrorCode, ErrorKind> = {
    [WorkspacesErrorCode.SignupDisabled]: "forbidden",
    [WorkspacesErrorCode.NotFound]: "not-found",
    [WorkspacesErrorCode.PlanUnknown]: "invalid",
    [WorkspacesErrorCode.NothingToKeep]: "invalid",
    [WorkspacesErrorCode.KeepNotFound]: "not-found",
    [WorkspacesErrorCode.DeleteFailed]: "internal",
    [WorkspacesErrorCode.NameInvalid]: "invalid",
    [WorkspacesErrorCode.NameAmbiguous]: "conflict",
    [WorkspacesErrorCode.NameUnavailable]: "conflict",
    [WorkspacesErrorCode.DeleteConfirmMismatch]: "invalid",
    [WorkspacesErrorCode.RestoreExpired]: "conflict",
    [WorkspacesErrorCode.EnterpriseKeyInvalid]: "invalid",
    [WorkspacesErrorCode.EnterpriseKeyTaken]: "conflict",
    [WorkspacesErrorCode.TimeZoneInvalid]: "invalid",
    [WorkspacesErrorCode.ThemeInvalid]: "invalid",
}

/** The one error class of the workspaces capability. */
export class WorkspacesError extends DomainError<WorkspacesErrorCode> {}
