import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the payOS integration, each saying WHERE the call failed (the adapter attaches what that proves): refused at the gateway before
 * any handler ran (`AuthFailed`, `RateLimited`), answered as a refusal with no effect (`Rejected`, `NotFound`), or its effect is not
 * known (`Unreachable`, `Failed`).
 */
export enum PayosErrorCode {
    /** The API could not be reached or did not answer in time: the request may have left. */
    Unreachable = "PAYOS_UNREACHABLE",
    /** The API answered a server failure (5xx) or something unreadable: the effect is not known. */
    Failed = "PAYOS_FAILED",
    /** The API answered 401 / 403. The docs file every sample error (bad signature, bad key, order exists...) under 401, so its words ride in the params. */
    AuthFailed = "PAYOS_AUTH_FAILED",
    /** The API asked the caller to slow down (429). */
    RateLimited = "PAYOS_RATE_LIMITED",
    /** The API has no such payment link (404). */
    NotFound = "PAYOS_NOT_FOUND",
    /** The API refused the request as asked (another 4xx, or a 2xx whose `code` is not "00"); its code and words ride in the params. */
    Rejected = "PAYOS_REJECTED",
}

/** How each payOS code travels. */
export const PAYOS_ERROR_KINDS: Record<PayosErrorCode, ErrorKind> = {
    [PayosErrorCode.Unreachable]: "unavailable",
    [PayosErrorCode.Failed]: "unavailable",
    [PayosErrorCode.AuthFailed]: "unavailable",
    [PayosErrorCode.RateLimited]: "unavailable",
    [PayosErrorCode.NotFound]: "not-found",
    [PayosErrorCode.Rejected]: "invalid",
}

/** The one error class of the payOS integration. */
export class PayosError extends DomainError<PayosErrorCode> {}
