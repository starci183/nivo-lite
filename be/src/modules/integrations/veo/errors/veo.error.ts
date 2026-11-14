import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the Veo integration (Veo through the Gemini API), by WHERE a call failed: `Unreachable` (the request may have left), an
 * answered status (https://aistudio.google.com/docs/api-errors.md: `AuthFailed` 401/403 PERMISSION_DENIED, `RateLimited` 429
 * RESOURCE_EXHAUSTED, `NotFound` 404, `Rejected` any other 4xx such as 400 INVALID_ARGUMENT or FAILED_PRECONDITION and 402 prepay
 * depleted: Google refused and did nothing; `Failed` 5xx: it may have acted), or `Malformed` (a success that cannot be read). The
 * status, Google's `error.status` word and its `error.message` ride in the params.
 */
export enum VeoErrorCode {
    /** Choose when no answer arrived (a network cut or a timeout): the request may have left, so Google (Veo) may or may not have acted. */
    Unreachable = "VEO_UNREACHABLE",
    /** Choose when Google (Veo) refused the credentials or the permission (401/403): nothing was done. */
    AuthFailed = "VEO_AUTH_FAILED",
    /** Choose when Google (Veo) answered 429 or named a limit: the call was throttled and nothing was done. */
    RateLimited = "VEO_RATE_LIMITED",
    /** Choose when Google (Veo) answered 404: the thing named does not exist. */
    NotFound = "VEO_NOT_FOUND",
    /** Choose when Google (Veo) refused the request with another 4xx: it did nothing. */
    Rejected = "VEO_REJECTED",
    /** Choose when Google (Veo) answered a 5xx: it may have acted. */
    Failed = "VEO_FAILED",
    /** Choose when a success answer cannot be read: Google (Veo) acted but its answer is unusable. */
    Malformed = "VEO_MALFORMED",
}

/** How each Veo code travels. */
export const VEO_ERROR_KINDS: Record<VeoErrorCode, ErrorKind> = {
    [VeoErrorCode.Unreachable]: "unavailable",
    [VeoErrorCode.AuthFailed]: "unavailable",
    [VeoErrorCode.RateLimited]: "rate-limited",
    [VeoErrorCode.NotFound]: "not-found",
    [VeoErrorCode.Rejected]: "invalid",
    [VeoErrorCode.Failed]: "unavailable",
    [VeoErrorCode.Malformed]: "unavailable",
}

/** The one error class of the Veo integration. */
export class VeoError extends DomainError<VeoErrorCode> {}
