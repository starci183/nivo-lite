import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { GoogleCalendarError, GoogleCalendarErrorCode } from "@modules/integrations/google-calendar"

/** The provider key of the Google account: Calendar is served by the same account as the Sheets and Drive grants (a scope granted on top). */
export const GOOGLE_CALENDAR_PROVIDER: typeof PROVIDER.google = PROVIDER.google

/**
 * A failure of the Calendar client as the generic port throws it, with what it proves by WHERE it failed: an answered refusal (a
 * credential or permission error, a 404 or a 410, any other 4xx such as 400 or 409 `duplicate`) is a `providerRefusal` proving no effect
 * (`not_sent`); a rate limit is rethrown as it is, proving no effect; a transport failure, a 5xx or an unreadable success may have acted
 * (`unknown`). Anything else proves nothing.
 */
export const googleCalendarFailureOf = (cause: unknown): unknown => {
    if (!(cause instanceof GoogleCalendarError)) return cause
    const detail = typeof cause.params.detail === "string" && cause.params.detail !== "" ? cause.params.detail : null
    switch (cause.code) {
        case GoogleCalendarErrorCode.AuthFailed:
            return withProof(providerRefusal(GOOGLE_CALENDAR_PROVIDER, "auth_refused", detail, cause), "not_sent")
        case GoogleCalendarErrorCode.NotFound:
        case GoogleCalendarErrorCode.Gone:
            return withProof(providerRefusal(GOOGLE_CALENDAR_PROVIDER, "not_found", detail, cause), "not_sent")
        case GoogleCalendarErrorCode.Rejected:
            return withProof(providerRefusal(GOOGLE_CALENDAR_PROVIDER, "rejected", detail, cause), "not_sent")
        case GoogleCalendarErrorCode.RateLimited:
            return withProof(cause, "not_sent")
        case GoogleCalendarErrorCode.Unreachable:
        case GoogleCalendarErrorCode.Failed:
        case GoogleCalendarErrorCode.Malformed:
            return withProof(cause, "unknown")
    }
}
