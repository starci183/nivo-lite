import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the authority capability. */
export enum AuthorityErrorCode {
    /** The database answered no row after saving the sheet. */
    NotSaved = "AUTHORITY_NOT_SAVED",
}

/** How each authority code travels. */
export const AUTHORITY_ERROR_KINDS: Record<AuthorityErrorCode, ErrorKind> = {
    [AuthorityErrorCode.NotSaved]: "internal",
}

/** The one error class of the authority capability. */
export class AuthorityError extends DomainError<AuthorityErrorCode> {}
