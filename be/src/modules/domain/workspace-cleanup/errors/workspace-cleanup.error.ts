import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the workspace-cleanup capability. */
export enum WorkspaceCleanupErrorCode {
    /** No workspace is named to keep: a cleanup would delete everything. */
    KeepRequired = "WORKSPACE_CLEANUP_KEEP_REQUIRED",
    /** A keep id is not a workspace id, or the list is longer than the bound. */
    KeepInvalid = "WORKSPACE_CLEANUP_KEEP_INVALID",
    /** A workspace to keep does not exist: the ids are wrong, so nothing is deleted. */
    KeepNotFound = "WORKSPACE_CLEANUP_KEEP_NOT_FOUND",
    /** Neither `--dry-run` nor `--execute` was given, or both were. */
    ModeRequired = "WORKSPACE_CLEANUP_MODE_REQUIRED",
    /** `--execute` was given without the digest of a reviewed dry-run receipt. */
    DigestRequired = "WORKSPACE_CLEANUP_DIGEST_REQUIRED",
    /** The fresh dry run does not match the reviewed receipt: something changed, so nothing is deleted. */
    DigestMismatch = "WORKSPACE_CLEANUP_DIGEST_MISMATCH",
    /** A bounded scan of workspaces or accounts did not reach the end. */
    ScanIncomplete = "WORKSPACE_CLEANUP_SCAN_INCOMPLETE",
    /** Supabase Auth refused to list the accounts. */
    AuthFailed = "WORKSPACE_CLEANUP_AUTH_FAILED",
    /** The footprint of a workspace did not answer row counts. */
    FootprintInvalid = "WORKSPACE_CLEANUP_FOOTPRINT_INVALID",
    /** An account delete failed; the run stopped there and names the accounts deleted and remaining. */
    UserDeleteFailed = "WORKSPACE_CLEANUP_USER_DELETE_FAILED",
    /** Kept data still references an account to delete through a key that refuses the delete; it names users and tables. */
    UserReferenceBlocked = "WORKSPACE_CLEANUP_USER_REFERENCE_BLOCKED",
    /** Deleting an account would cascade-delete kept rows and `--allow-kept-cascade` is not set; it names users and tables. */
    KeptCascadeRefused = "WORKSPACE_CLEANUP_KEPT_CASCADE_REFUSED",
    /** The references of an account did not answer row counts. */
    ReferencesInvalid = "WORKSPACE_CLEANUP_REFERENCES_INVALID",
}

/** How each workspace-cleanup code travels. */
export const WORKSPACE_CLEANUP_ERROR_KINDS: Record<WorkspaceCleanupErrorCode, ErrorKind> = {
    [WorkspaceCleanupErrorCode.KeepRequired]: "invalid",
    [WorkspaceCleanupErrorCode.KeepInvalid]: "invalid",
    [WorkspaceCleanupErrorCode.KeepNotFound]: "not-found",
    [WorkspaceCleanupErrorCode.ModeRequired]: "invalid",
    [WorkspaceCleanupErrorCode.DigestRequired]: "invalid",
    [WorkspaceCleanupErrorCode.DigestMismatch]: "conflict",
    [WorkspaceCleanupErrorCode.ScanIncomplete]: "unavailable",
    [WorkspaceCleanupErrorCode.AuthFailed]: "unavailable",
    [WorkspaceCleanupErrorCode.FootprintInvalid]: "internal",
    [WorkspaceCleanupErrorCode.UserDeleteFailed]: "internal",
    [WorkspaceCleanupErrorCode.UserReferenceBlocked]: "conflict",
    [WorkspaceCleanupErrorCode.KeptCascadeRefused]: "conflict",
    [WorkspaceCleanupErrorCode.ReferencesInvalid]: "internal",
}

/** The one error class of the workspace-cleanup capability. */
export class WorkspaceCleanupError extends DomainError<WorkspaceCleanupErrorCode> {}
