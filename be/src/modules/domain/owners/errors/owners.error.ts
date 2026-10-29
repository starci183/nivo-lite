import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the owners capability. */
export enum OwnersErrorCode {
    /** The database did not return the hash of the password it was asked to compute. */
    PasswordNotHashed = "OWNERS_PASSWORD_NOT_HASHED",
}

/** How each owners code travels. */
export const OWNERS_ERROR_KINDS: Record<OwnersErrorCode, ErrorKind> = {
    [OwnersErrorCode.PasswordNotHashed]: "unavailable",
}

/** The one error class of the owners capability. */
export class OwnersError extends DomainError<OwnersErrorCode> {}
