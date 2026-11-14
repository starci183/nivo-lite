import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the ElevenLabs integration, by WHERE a call failed: `Unreachable` (the request may have left: a network cut or a timeout),
 * an answered status (`AuthFailed` 401/403, `RateLimited` 429, `NotFound` 404, `Rejected` any other 4xx: ElevenLabs refused and did
 * nothing; `Failed` 5xx: it may have acted), or an unreadable success (`Malformed`: it acted, its answer cannot be read). The status
 * and ElevenLabs' own words (`detail`) ride in the params.
 */
export enum ElevenlabsErrorCode {
    /** Choose when no answer arrived (a network cut or a timeout): the request may have left, so ElevenLabs may or may not have acted. */
    Unreachable = "ELEVENLABS_UNREACHABLE",
    /** Choose when ElevenLabs refused the credentials or the permission (401/403): nothing was done. */
    AuthFailed = "ELEVENLABS_AUTH_FAILED",
    /** Choose when ElevenLabs answered 429 or named a limit: the call was throttled and nothing was done. */
    RateLimited = "ELEVENLABS_RATE_LIMITED",
    /** Choose when ElevenLabs answered 404: the thing named does not exist. */
    NotFound = "ELEVENLABS_NOT_FOUND",
    /** Choose when ElevenLabs refused the request with another 4xx: it did nothing. */
    Rejected = "ELEVENLABS_REJECTED",
    /** Choose when ElevenLabs answered a 5xx: it may have acted. */
    Failed = "ELEVENLABS_FAILED",
    /** Choose when a success answer cannot be read: ElevenLabs acted but its answer is unusable. */
    Malformed = "ELEVENLABS_MALFORMED",
}

/** How each ElevenLabs code travels. */
export const ELEVENLABS_ERROR_KINDS: Record<ElevenlabsErrorCode, ErrorKind> = {
    [ElevenlabsErrorCode.Unreachable]: "unavailable",
    [ElevenlabsErrorCode.AuthFailed]: "unavailable",
    [ElevenlabsErrorCode.RateLimited]: "rate-limited",
    [ElevenlabsErrorCode.NotFound]: "not-found",
    [ElevenlabsErrorCode.Rejected]: "invalid",
    [ElevenlabsErrorCode.Failed]: "unavailable",
    [ElevenlabsErrorCode.Malformed]: "unavailable",
}

/** The one error class of the ElevenLabs integration. */
export class ElevenlabsError extends DomainError<ElevenlabsErrorCode> {}
