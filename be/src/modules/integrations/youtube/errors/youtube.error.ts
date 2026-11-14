import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the YouTube Data API integration, by WHERE a call failed: `Unreachable` (the request may have left), an answered status
 * (https://developers.google.com/youtube/v3/docs/errors: `AuthFailed` 401 / 403 `forbidden` / `insufficientPermissions` /
 * `youtubeSignupRequired`, `RateLimited` 429 or the reasons `quotaExceeded` / `uploadRateLimitExceeded` / `rateLimitExceeded`, `NotFound`
 * 404, `Rejected` any other 4xx or a documented content refusal such as `forbiddenPrivacySetting`: YouTube refused and did nothing;
 * `Failed` 5xx or a 308 on a one-shot upload: it may have acted), or `Malformed` (a success that cannot be read). The status, the first
 * error `reason` and the `message` ride in the params.
 */
export enum YoutubeErrorCode {
    /** Choose when no answer arrived (a network cut or a timeout): the request may have left, so YouTube may or may not have acted. */
    Unreachable = "YOUTUBE_UNREACHABLE",
    /** Choose when YouTube refused the credentials or the permission (401/403): nothing was done. */
    AuthFailed = "YOUTUBE_AUTH_FAILED",
    /** Choose when YouTube answered 429 or named a limit: the call was throttled and nothing was done. */
    RateLimited = "YOUTUBE_RATE_LIMITED",
    /** Choose when YouTube answered 404: the thing named does not exist. */
    NotFound = "YOUTUBE_NOT_FOUND",
    /** Choose when YouTube refused the request with another 4xx: it did nothing. */
    Rejected = "YOUTUBE_REJECTED",
    /** Choose when YouTube answered a 5xx: it may have acted. */
    Failed = "YOUTUBE_FAILED",
    /** Choose when a success answer cannot be read: YouTube acted but its answer is unusable. */
    Malformed = "YOUTUBE_MALFORMED",
}

/** How each YouTube code travels. */
export const YOUTUBE_ERROR_KINDS: Record<YoutubeErrorCode, ErrorKind> = {
    [YoutubeErrorCode.Unreachable]: "unavailable",
    [YoutubeErrorCode.AuthFailed]: "unavailable",
    [YoutubeErrorCode.RateLimited]: "rate-limited",
    [YoutubeErrorCode.NotFound]: "not-found",
    [YoutubeErrorCode.Rejected]: "invalid",
    [YoutubeErrorCode.Failed]: "unavailable",
    [YoutubeErrorCode.Malformed]: "unavailable",
}

/** The one error class of the YouTube integration. */
export class YoutubeError extends DomainError<YoutubeErrorCode> {}
