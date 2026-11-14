import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the TikTok integration, by WHERE a call failed: `Unreachable` (the request may have left), an answered status
 * (https://developers.tiktok.com/doc/content-posting-api-reference-direct-post, "Error Codes": `AuthFailed` 401 `access_token_invalid` /
 * `scope_not_authorized`, `RateLimited` 429 `rate_limit_exceeded`, `NotFound` 404, `Rejected` every other 4xx INCLUDING the 403
 * `spam_risk_*`, `url_ownership_unverified`, `privacy_level_option_mismatch`, `unaudited_client_can_only_post_to_private_accounts`
 * (TikTok refused the post and did nothing) and a 200 whose `error.code` is not `ok`; `Failed` 5xx: it may have acted), `NotConfigured`
 * (no app client on this deployment: nothing was sent) or `Malformed` (a success that cannot be read). The status, TikTok's
 * `error.code` word and its message ride in the params.
 */
export enum TiktokErrorCode {
    /** Choose when no answer arrived (a network cut or a timeout): the request may have left, so TikTok may or may not have acted. */
    Unreachable = "TIKTOK_UNREACHABLE",
    /** Choose when this deployment has no TikTok app client: nothing was sent. */
    NotConfigured = "TIKTOK_NOT_CONFIGURED",
    /** Choose when TikTok refused the credentials or the permission (401/403): nothing was done. */
    AuthFailed = "TIKTOK_AUTH_FAILED",
    /** Choose when TikTok answered 429 or named a limit: the call was throttled and nothing was done. */
    RateLimited = "TIKTOK_RATE_LIMITED",
    /** Choose when TikTok answered 404: the thing named does not exist. */
    NotFound = "TIKTOK_NOT_FOUND",
    /** Choose when TikTok refused the request with another 4xx: it did nothing. */
    Rejected = "TIKTOK_REJECTED",
    /** Choose when TikTok answered a 5xx: it may have acted. */
    Failed = "TIKTOK_FAILED",
    /** Choose when a success answer cannot be read: TikTok acted but its answer is unusable. */
    Malformed = "TIKTOK_MALFORMED",
}

/** How each TikTok code travels. */
export const TIKTOK_ERROR_KINDS: Record<TiktokErrorCode, ErrorKind> = {
    [TiktokErrorCode.Unreachable]: "unavailable",
    [TiktokErrorCode.NotConfigured]: "unavailable",
    [TiktokErrorCode.AuthFailed]: "unavailable",
    [TiktokErrorCode.RateLimited]: "rate-limited",
    [TiktokErrorCode.NotFound]: "not-found",
    [TiktokErrorCode.Rejected]: "invalid",
    [TiktokErrorCode.Failed]: "unavailable",
    [TiktokErrorCode.Malformed]: "unavailable",
}

/** The one error class of the TikTok integration. */
export class TiktokError extends DomainError<TiktokErrorCode> {}
