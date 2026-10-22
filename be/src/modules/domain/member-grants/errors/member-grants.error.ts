import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the member-grants capability. */
export enum MemberGrantsErrorCode {
    /** The member is not in the workspace, or the action is not in the registry. */
    UnknownTarget = "MEMBER_GRANTS_UNKNOWN_TARGET",
    /** The limit is negative or not a number. */
    InvalidLimit = "MEMBER_GRANTS_INVALID_LIMIT",
}

/** How each member-grants code travels. */
export const MEMBER_GRANTS_ERROR_KINDS: Record<MemberGrantsErrorCode, ErrorKind> = {
    [MemberGrantsErrorCode.UnknownTarget]: "not-found",
    [MemberGrantsErrorCode.InvalidLimit]: "invalid",
}

/** The one error class of the member-grants capability. */
export class MemberGrantsError extends DomainError<MemberGrantsErrorCode> {}
