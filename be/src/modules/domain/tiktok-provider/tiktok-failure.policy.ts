import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { TiktokError, TiktokErrorCode } from "@modules/integrations/tiktok"

/** The provider key of TikTok. */
export const TIKTOK_PROVIDER: string = PROVIDER.tiktok

/**
 * A failure of the TikTok client as the destination port throws it, with what it proves by WHERE it failed: an answered refusal (a
 * refused token, a 4xx, an argument NIVO would not send, no app client) is a `providerRefusal` proving no effect (`not_sent`); a rate
 * limit is rethrown as it is, proving no effect; a transport failure, a 5xx or an unreadable success may have acted (`unknown`).
 * Anything else proves nothing.
 */
export const tiktokFailureOf = (cause: unknown): unknown => {
    if (!(cause instanceof TiktokError)) return cause
    const detail = typeof cause.params.detail === "string" && cause.params.detail !== "" ? cause.params.detail : null
    switch (cause.code) {
        case TiktokErrorCode.AuthFailed:
            return withProof(providerRefusal(TIKTOK_PROVIDER, "auth_refused", detail, cause), "not_sent")
        case TiktokErrorCode.NotFound:
            return withProof(providerRefusal(TIKTOK_PROVIDER, "not_found", detail, cause), "not_sent")
        case TiktokErrorCode.Rejected:
            return withProof(providerRefusal(TIKTOK_PROVIDER, "rejected", detail, cause), "not_sent")
        case TiktokErrorCode.NotConfigured:
            return withProof(providerRefusal(TIKTOK_PROVIDER, "not_available", "app client", cause), "not_sent")
        case TiktokErrorCode.RateLimited:
            return withProof(cause, "not_sent")
        case TiktokErrorCode.Unreachable:
        case TiktokErrorCode.Failed:
        case TiktokErrorCode.Malformed:
            return withProof(cause, "unknown")
    }
}
