import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the Google Calendar integration, by WHERE a call failed (https://developers.google.com/workspace/calendar/api/guides/errors):
 * `Unreachable` (the request may have left); an answered status: `AuthFailed` (401 `authError`, or a 403 that is no limit),
 * `RateLimited` (429, or a 403 whose reason is `userRateLimitExceeded`, `rateLimitExceeded` or `quotaExceeded`: the page says to treat them
 * as limits), `NotFound` (404 `notFound`), `Gone` (410 `deleted`: "already deleted, no action needed"; 410 `fullSyncRequired` /
 * `updatedMinTooLongAgo` belong to sync tokens NIVO never sends), `Rejected` (any other 4xx, among them 400 and 409 `duplicate`: Calendar
 * refused and did nothing), `Failed` (5xx: it may have acted), `Malformed` (a success that cannot be read). The status, the first error
 * `reason` and the `message` ride in the params.
 */
export enum GoogleCalendarErrorCode {
    /** Choose when no answer arrived (a network cut or a timeout): the request may have left, so Google Calendar may or may not have acted. */
    Unreachable = "GOOGLE_CALENDAR_UNREACHABLE",
    /** Choose when Google answered 401, or a 403 that is no limit: the credentials were refused and nothing was done. */
    AuthFailed = "GOOGLE_CALENDAR_AUTH_FAILED",
    /** Choose when Google Calendar answered 429 or named a limit: the call was throttled and nothing was done. */
    RateLimited = "GOOGLE_CALENDAR_RATE_LIMITED",
    /** Choose when Google Calendar answered 404: the thing named does not exist. */
    NotFound = "GOOGLE_CALENDAR_NOT_FOUND",
    /** Choose when Google Calendar answered 410: the event is already deleted, so no action is needed. */
    Gone = "GOOGLE_CALENDAR_GONE",
    /** Choose when Google Calendar refused the request with another 4xx: it did nothing. */
    Rejected = "GOOGLE_CALENDAR_REJECTED",
    /** Choose when Google Calendar answered a 5xx: it may have acted. */
    Failed = "GOOGLE_CALENDAR_FAILED",
    /** Choose when a success answer cannot be read: Google Calendar acted but its answer is unusable. */
    Malformed = "GOOGLE_CALENDAR_MALFORMED",
}

/** How each Google Calendar code travels. */
export const GOOGLE_CALENDAR_ERROR_KINDS: Record<GoogleCalendarErrorCode, ErrorKind> = {
    [GoogleCalendarErrorCode.Unreachable]: "unavailable",
    [GoogleCalendarErrorCode.AuthFailed]: "unavailable",
    [GoogleCalendarErrorCode.RateLimited]: "rate-limited",
    [GoogleCalendarErrorCode.NotFound]: "not-found",
    [GoogleCalendarErrorCode.Gone]: "not-found",
    [GoogleCalendarErrorCode.Rejected]: "invalid",
    [GoogleCalendarErrorCode.Failed]: "unavailable",
    [GoogleCalendarErrorCode.Malformed]: "unavailable",
}

/** The one error class of the Google Calendar integration. */
export class GoogleCalendarError extends DomainError<GoogleCalendarErrorCode> {}
