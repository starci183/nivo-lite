import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the Meta publishing integration (Facebook Page posts and Instagram content publishing through the Graph API), by WHERE a call
 * failed: `Unreachable` (the request may have left), an answered error (https://developers.facebook.com/docs/graph-api/guides/error-handling:
 * `AuthFailed` code 190 / 102 / 10 / 3 / 200-299 or a 401 / 403 status, `RateLimited` code 4 / 17 / 341 or 429, `NotFound` 404, `Rejected` any
 * other refusal of the request such as code 368, 506, 1609005 or another 4xx: Meta refused and did nothing; `Failed` code 1 / 2 or a 5xx: it may
 * have acted), or `Malformed` (a success that cannot be read). The status, Meta's `error.code` and its `error.message` ride in the params.
 */
export enum MetaPublishingErrorCode {
    /** Choose when no answer arrived (a network cut or a timeout): the request may have left, so Meta may or may not have acted. */
    Unreachable = "META_PUBLISHING_UNREACHABLE",
    /** Choose when Meta refused the credentials or the permission (401/403): nothing was done. */
    AuthFailed = "META_PUBLISHING_AUTH_FAILED",
    /** Choose when Meta answered 429 or named a limit: the call was throttled and nothing was done. */
    RateLimited = "META_PUBLISHING_RATE_LIMITED",
    /** Choose when Meta answered 404: the thing named does not exist. */
    NotFound = "META_PUBLISHING_NOT_FOUND",
    /** Choose when Meta refused the request with another 4xx: it did nothing. */
    Rejected = "META_PUBLISHING_REJECTED",
    /** Choose when Meta answered a 5xx: it may have acted. */
    Failed = "META_PUBLISHING_FAILED",
    /** Choose when a success answer cannot be read: Meta acted but its answer is unusable. */
    Malformed = "META_PUBLISHING_MALFORMED",
}

/** How each Meta publishing code travels. */
export const META_PUBLISHING_ERROR_KINDS: Record<MetaPublishingErrorCode, ErrorKind> = {
    [MetaPublishingErrorCode.Unreachable]: "unavailable",
    [MetaPublishingErrorCode.AuthFailed]: "unavailable",
    [MetaPublishingErrorCode.RateLimited]: "rate-limited",
    [MetaPublishingErrorCode.NotFound]: "not-found",
    [MetaPublishingErrorCode.Rejected]: "invalid",
    [MetaPublishingErrorCode.Failed]: "unavailable",
    [MetaPublishingErrorCode.Malformed]: "unavailable",
}

/** The one error class of the Meta publishing integration. */
export class MetaPublishingError extends DomainError<MetaPublishingErrorCode> {}
