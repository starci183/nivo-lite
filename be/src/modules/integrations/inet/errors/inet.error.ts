import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the iNET integration, each saying WHERE the call failed (the adapter attaches what that proves, `withProof`): the request
 * never reached the provider's handler (`AuthFailed`, `RateLimited`, `NotServed`: refused at its gateway), it reached it and was refused
 * (`Rejected`, `Conflict`: an answer, no effect), or its effect is not known (`Unreachable`, `Failed`).
 */
export enum InetErrorCode {
    /** The API could not be reached or did not answer in time: the request may have left. */
    Unreachable = "INET_UNREACHABLE",
    /** The API answered a server failure (5xx) or something unreadable: the effect is not known. */
    Failed = "INET_FAILED",
    /** The API refused the credential (401 / 403): wrong, expired, revoked, out of scope or from an IP not allowed. */
    AuthFailed = "INET_AUTH_FAILED",
    /** The API asked the caller to slow down (429). */
    RateLimited = "INET_RATE_LIMITED",
    /** The API has no such operation (404 at its gateway). */
    NotServed = "INET_NOT_SERVED",
    /** The API refused the request as asked (its business refusal); the provider's own code or status rides in the params. */
    Rejected = "INET_REJECTED",
    /** The API answered the resource already exists (409). */
    Conflict = "INET_CONFLICT",
}

/** How each iNET code travels. */
export const INET_ERROR_KINDS: Record<InetErrorCode, ErrorKind> = {
    [InetErrorCode.Unreachable]: "unavailable",
    [InetErrorCode.Failed]: "unavailable",
    [InetErrorCode.AuthFailed]: "unavailable",
    [InetErrorCode.RateLimited]: "unavailable",
    [InetErrorCode.NotServed]: "unavailable",
    [InetErrorCode.Rejected]: "invalid",
    [InetErrorCode.Conflict]: "invalid",
}

/** The one error class of the iNET integration. */
export class InetError extends DomainError<InetErrorCode> {}
