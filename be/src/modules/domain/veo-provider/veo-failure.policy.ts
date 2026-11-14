import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { VeoError, VeoErrorCode } from "@modules/integrations/veo"

/** The provider key of Veo: its own key with its own API key, never the `google` OAuth account (Sheets, Drive). */
export const VEO_PROVIDER: typeof PROVIDER.veo = PROVIDER.veo

/**
 * A failure of the Veo client as the generic ports throw it, with what it proves by WHERE it failed: an answered refusal (401/403, 404,
 * any other 4xx, or an argument NIVO would not send) is a `providerRefusal` proving no effect (`not_sent`); a rate limit is rethrown as
 * it is, proving no effect; a transport failure, a 5xx or an unreadable success may have acted (`unknown`). Anything else proves nothing.
 */
export const veoFailureOf = (cause: unknown): unknown => {
    if (!(cause instanceof VeoError)) return cause
    const detail = typeof cause.params.detail === "string" && cause.params.detail !== "" ? cause.params.detail : null
    switch (cause.code) {
        case VeoErrorCode.AuthFailed:
            return withProof(providerRefusal(VEO_PROVIDER, "auth_refused", detail, cause), "not_sent")
        case VeoErrorCode.NotFound:
            return withProof(providerRefusal(VEO_PROVIDER, "not_found", detail, cause), "not_sent")
        case VeoErrorCode.Rejected:
            return withProof(providerRefusal(VEO_PROVIDER, "rejected", detail, cause), "not_sent")
        case VeoErrorCode.RateLimited:
            return withProof(cause, "not_sent")
        case VeoErrorCode.Unreachable:
        case VeoErrorCode.Failed:
        case VeoErrorCode.Malformed:
            return withProof(cause, "unknown")
    }
}
