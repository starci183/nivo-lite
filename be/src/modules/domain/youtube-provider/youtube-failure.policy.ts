import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { YoutubeError, YoutubeErrorCode } from "@modules/integrations/youtube"

/** The provider key of the Google account: it reaches the domain `youtube` through the Data API (the Sheets and Drive grants are the same provider). */
export const YOUTUBE_PROVIDER: typeof PROVIDER.google = PROVIDER.google

/**
 * A failure of the YouTube client as the destination ports throw it, with what it proves by WHERE it failed: an answered refusal
 * (a credential or permission error, a 404, any other refusal, or an id NIVO would not send) is a `providerRefusal` proving no effect
 * (`not_sent`); a rate limit is rethrown as it is, proving no effect; a transport failure, an outage answer or an unreadable success may
 * have acted (`unknown`). Anything else proves nothing.
 */
export const youtubeFailureOf = (cause: unknown): unknown => {
    if (!(cause instanceof YoutubeError)) return cause
    const detail = typeof cause.params.detail === "string" && cause.params.detail !== "" ? cause.params.detail : null
    switch (cause.code) {
        case YoutubeErrorCode.AuthFailed:
            return withProof(providerRefusal(YOUTUBE_PROVIDER, "auth_refused", detail, cause), "not_sent")
        case YoutubeErrorCode.NotFound:
            return withProof(providerRefusal(YOUTUBE_PROVIDER, "not_found", detail, cause), "not_sent")
        case YoutubeErrorCode.Rejected:
            return withProof(providerRefusal(YOUTUBE_PROVIDER, "rejected", detail, cause), "not_sent")
        case YoutubeErrorCode.RateLimited:
            return withProof(cause, "not_sent")
        case YoutubeErrorCode.Unreachable:
        case YoutubeErrorCode.Failed:
        case YoutubeErrorCode.Malformed:
            return withProof(cause, "unknown")
    }
}
