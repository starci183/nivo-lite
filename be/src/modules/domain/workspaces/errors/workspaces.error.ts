import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

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
    /** No OpenClaw gateway is configured here, so deleting would leave the workspace's agents behind. */
    OpenclawUnavailable = "WORKSPACES_OPENCLAW_UNAVAILABLE",
    /** Some workspaces could not be deleted. */
    DeleteFailed = "WORKSPACES_DELETE_FAILED",
    /** An explicit workspace name is missing or exceeds the supported bound. */
    NameInvalid = "WORKSPACES_NAME_INVALID",
    /** More than one owned active workspace has the requested exact name. */
    NameAmbiguous = "WORKSPACES_NAME_AMBIGUOUS",
    /** The named workspace or owner seat is inactive and must be restored explicitly. */
    NameUnavailable = "WORKSPACES_NAME_UNAVAILABLE",
}

/** How each workspaces code travels. */
export const WORKSPACES_ERROR_KINDS: Record<WorkspacesErrorCode, ErrorKind> = {
    [WorkspacesErrorCode.SignupDisabled]: "forbidden",
    [WorkspacesErrorCode.NotFound]: "not-found",
    [WorkspacesErrorCode.PlanUnknown]: "invalid",
    [WorkspacesErrorCode.NothingToKeep]: "invalid",
    [WorkspacesErrorCode.KeepNotFound]: "not-found",
    [WorkspacesErrorCode.OpenclawUnavailable]: "unavailable",
    [WorkspacesErrorCode.DeleteFailed]: "internal",
    [WorkspacesErrorCode.NameInvalid]: "invalid",
    [WorkspacesErrorCode.NameAmbiguous]: "conflict",
    [WorkspacesErrorCode.NameUnavailable]: "conflict",
}

/** The one error class of the workspaces capability. */
export class WorkspacesError extends DomainError<WorkspacesErrorCode> {}
