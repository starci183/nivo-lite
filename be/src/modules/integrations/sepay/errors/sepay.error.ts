import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the SePay integration. */
export enum SepayErrorCode {
    /** The SePay user API could not be reached, did not answer in time or answered something unreadable. */
    Unavailable = "SEPAY_UNAVAILABLE",
    /** The SePay user API refused the call for a reason that retrying cannot change (the reason rides in the params). */
    Rejected = "SEPAY_REJECTED",
    /** The SePay user API refused the API token (401 or 403): it is wrong, revoked or lacks the right. */
    AuthFailed = "SEPAY_AUTH_FAILED",
    /** The SePay user API asked the caller to slow down. */
    RateLimited = "SEPAY_RATE_LIMITED",
}

/** How each SePay code travels. */
export const SEPAY_ERROR_KINDS: Record<SepayErrorCode, ErrorKind> = {
    [SepayErrorCode.Unavailable]: "unavailable",
    [SepayErrorCode.Rejected]: "unavailable",
    [SepayErrorCode.AuthFailed]: "unavailable",
    [SepayErrorCode.RateLimited]: "unavailable",
}

/** The one error class of the SePay integration. */
export class SepayError extends DomainError<SepayErrorCode> {}
