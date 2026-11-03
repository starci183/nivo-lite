import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the SePay integration. */
export enum SepayErrorCode {
    /** The SePay user API could not be reached, did not answer in time or answered something unreadable. */
    Unavailable = "SEPAY_UNAVAILABLE",
    /** The SePay user API refused the call: a wrong or revoked API token (the reason rides in the params). */
    Rejected = "SEPAY_REJECTED",
    /** The SePay user API asked the caller to slow down. */
    RateLimited = "SEPAY_RATE_LIMITED",
}

/** How each SePay code travels. */
export const SEPAY_ERROR_KINDS: Record<SepayErrorCode, ErrorKind> = {
    [SepayErrorCode.Unavailable]: "unavailable",
    [SepayErrorCode.Rejected]: "unavailable",
    [SepayErrorCode.RateLimited]: "unavailable",
}

/** The one error class of the SePay integration. */
export class SepayError extends DomainError<SepayErrorCode> {}
