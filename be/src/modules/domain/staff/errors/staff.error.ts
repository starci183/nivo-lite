import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the staff capability. */
export enum StaffErrorCode {
    /** A staff row needs a name. */
    NameRequired = "STAFF_NAME_REQUIRED",
    /** The staff row is not in the workspace. */
    NotFound = "STAFF_NOT_FOUND",
}

/** How each staff code travels. */
export const STAFF_ERROR_KINDS: Record<StaffErrorCode, ErrorKind> = {
    [StaffErrorCode.NameRequired]: "invalid",
    [StaffErrorCode.NotFound]: "not-found",
}

/** The one error class of the staff capability. */
export class StaffError extends DomainError<StaffErrorCode> {}
