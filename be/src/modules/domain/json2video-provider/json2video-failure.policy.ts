import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { Json2videoError, Json2videoErrorCode } from "@modules/integrations/json2video"

/** The provider key of JSON2Video: its own key with its own API key. */
export const JSON2VIDEO_PROVIDER: string = PROVIDER.json2video

/**
 * A failure of the JSON2Video client as the compose port throws it, with what it proves by WHERE it failed: an answered refusal (401/403,
 * 404, any other 4xx, or an argument NIVO would not send) is a `providerRefusal` proving no effect (`not_sent`), JSON2Video's words riding
 * as the detail; a rate limit is rethrown as it is, proving no effect (the tool runner then goes on to the next compose account); a
 * transport failure, a 5xx or an unreadable success may have acted (`unknown`). Anything else proves nothing.
 */
export const json2videoFailureOf = (cause: unknown): unknown => {
    if (!(cause instanceof Json2videoError)) return cause
    const detail = typeof cause.params.detail === "string" && cause.params.detail !== "" ? cause.params.detail : null
    switch (cause.code) {
        case Json2videoErrorCode.AuthFailed:
            return withProof(providerRefusal(JSON2VIDEO_PROVIDER, "auth_refused", detail, cause), "not_sent")
        case Json2videoErrorCode.NotFound:
            return withProof(providerRefusal(JSON2VIDEO_PROVIDER, "not_found", detail, cause), "not_sent")
        case Json2videoErrorCode.Rejected:
            return withProof(providerRefusal(JSON2VIDEO_PROVIDER, "rejected", detail, cause), "not_sent")
        case Json2videoErrorCode.RateLimited:
            return withProof(cause, "not_sent")
        case Json2videoErrorCode.Unreachable:
        case Json2videoErrorCode.Failed:
        case Json2videoErrorCode.Malformed:
            return withProof(cause, "unknown")
    }
}
