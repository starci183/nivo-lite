import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the Creatomate integration, by WHERE a call failed: `Unreachable` (the request may have left), an answered status
 * (https://creatomate.com/docs/api/reference/introduction: 400 malformed or a RenderScript value the engine rejects, 401 key missing
 * or invalid, 402 credits exhausted, 404 template or render not in the project, 429 rate limit; `AuthFailed` 401/403, `RateLimited` 429,
 * `NotFound` 404, `Rejected` any other 4xx: Creatomate refused and did nothing; `Failed` 5xx: it may have acted), or `Malformed` (a
 * success that cannot be read). The status and Creatomate's `hint` ride in the params.
 */
export enum CreatomateErrorCode {
    /** The request may have left; choosing it tells the caller the render may or may not have started. */
    Unreachable = "CREATOMATE_UNREACHABLE",
    /** The key was refused (401/403); choosing it tells the caller the connection needs a new key. */
    AuthFailed = "CREATOMATE_AUTH_FAILED",
    /** Creatomate throttled the call (429); choosing it tells the caller to wait the retry delay and try again. */
    RateLimited = "CREATOMATE_RATE_LIMITED",
    /** The template or render is not in the project (404); choosing it tells the caller the id is wrong. */
    NotFound = "CREATOMATE_NOT_FOUND",
    /** Any other 4xx: Creatomate refused and did nothing; choosing it tells the caller the request itself must change. */
    Rejected = "CREATOMATE_REJECTED",
    /** A 5xx: Creatomate may have acted; choosing it tells the caller to check the render before retrying. */
    Failed = "CREATOMATE_FAILED",
    /** A success whose body cannot be read; choosing it tells the caller the answer is unusable. */
    Malformed = "CREATOMATE_MALFORMED",
}

/** How each Creatomate code travels. */
export const CREATOMATE_ERROR_KINDS: Record<CreatomateErrorCode, ErrorKind> = {
    [CreatomateErrorCode.Unreachable]: "unavailable",
    [CreatomateErrorCode.AuthFailed]: "unavailable",
    [CreatomateErrorCode.RateLimited]: "rate-limited",
    [CreatomateErrorCode.NotFound]: "not-found",
    [CreatomateErrorCode.Rejected]: "invalid",
    [CreatomateErrorCode.Failed]: "unavailable",
    [CreatomateErrorCode.Malformed]: "unavailable",
}

/** The one error class of the Creatomate integration. */
export class CreatomateError extends DomainError<CreatomateErrorCode> {}
