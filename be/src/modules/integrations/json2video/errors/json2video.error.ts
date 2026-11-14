import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the JSON2Video integration, by WHERE a call failed: `Unreachable` (the request may have left), an answered status
 * (https://json2video.com/docs/v2/reference/errors: `AuthFailed` 401 plan quota / resolution beyond the plan and 403 role, storage or
 * suspended account, `RateLimited` 429 (JSON2Video documents none; read generically), `NotFound` 404, `Rejected` any other 4xx such as
 * 400 validation / invalid key or 413 movie JSON over 2 MB: JSON2Video refused and did nothing; `Failed` 5xx: it may have acted), or
 * `Malformed` (a success that cannot be read). The status, JSON2Video's `code` word and its `message` ride in the params.
 */
export enum Json2videoErrorCode {
    /** The request may have left but no answer came: the call is reported as an unavailable service. */
    Unreachable = "JSON2VIDEO_UNREACHABLE",
    /** JSON2Video refused the key, plan or role (401, 403): the call is reported as an unavailable service. */
    AuthFailed = "JSON2VIDEO_AUTH_FAILED",
    /** JSON2Video answered 429: the call is reported as rate limited. */
    RateLimited = "JSON2VIDEO_RATE_LIMITED",
    /** JSON2Video answered 404: the call is reported as not found. */
    NotFound = "JSON2VIDEO_NOT_FOUND",
    /** JSON2Video refused the request with another 4xx and did nothing: the call is reported as invalid. */
    Rejected = "JSON2VIDEO_REJECTED",
    /** JSON2Video answered 5xx and may have acted: the call is reported as an unavailable service. */
    Failed = "JSON2VIDEO_FAILED",
    /** JSON2Video answered success with a body that cannot be read: the call is reported as an unavailable service. */
    Malformed = "JSON2VIDEO_MALFORMED",
}

/** How each JSON2Video code travels. */
export const JSON2VIDEO_ERROR_KINDS: Record<Json2videoErrorCode, ErrorKind> = {
    [Json2videoErrorCode.Unreachable]: "unavailable",
    [Json2videoErrorCode.AuthFailed]: "unavailable",
    [Json2videoErrorCode.RateLimited]: "rate-limited",
    [Json2videoErrorCode.NotFound]: "not-found",
    [Json2videoErrorCode.Rejected]: "invalid",
    [Json2videoErrorCode.Failed]: "unavailable",
    [Json2videoErrorCode.Malformed]: "unavailable",
}

/** The one error class of the JSON2Video integration. */
export class Json2videoError extends DomainError<Json2videoErrorCode> {}
