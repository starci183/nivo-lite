import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the leads capability. */
export enum LeadsErrorCode {
    /** No lead of the workspace has the requested id. */
    NotFound = "LEADS_NOT_FOUND",
    /** The caller may not decide this public comment. */
    CommentNotAllowed = "LEADS_COMMENT_NOT_ALLOWED",
    /** The public comment is not waiting for a decision any more. */
    CommentNotWaiting = "LEADS_COMMENT_NOT_WAITING",
    /** The public comment could not be answered. */
    CommentFailed = "LEADS_COMMENT_FAILED",
}

/** How each leads code travels. */
export const LEADS_ERROR_KINDS: Record<LeadsErrorCode, ErrorKind> = {
    [LeadsErrorCode.NotFound]: "not-found",
    [LeadsErrorCode.CommentNotAllowed]: "forbidden",
    [LeadsErrorCode.CommentNotWaiting]: "conflict",
    [LeadsErrorCode.CommentFailed]: "internal",
}

/** The one error class of the leads capability. */
export class LeadsError extends DomainError<LeadsErrorCode> {}
