import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { ElevenlabsError, ElevenlabsErrorCode } from "@modules/integrations/elevenlabs"

/** The provider key of ElevenLabs. */
export const ELEVENLABS_PROVIDER: typeof PROVIDER.elevenlabs = PROVIDER.elevenlabs

/**
 * A failure of the ElevenLabs client as the generic ports throw it, with what it proves by WHERE it failed: an answered refusal (401/403,
 * 404, any other 4xx) is a `providerRefusal` that proves no effect (`not_sent`); a rate limit is rethrown as it is (a retry reads it),
 * proving no effect; a transport failure, a 5xx or an unreadable success may have acted (`unknown`). Anything else is rethrown as it is,
 * proving nothing.
 */
export const elevenLabsFailureOf = (cause: unknown): unknown => {
    if (!(cause instanceof ElevenlabsError)) return cause
    const detail = typeof cause.params.detail === "string" && cause.params.detail !== "" ? cause.params.detail : null
    switch (cause.code) {
        case ElevenlabsErrorCode.AuthFailed:
            return withProof(providerRefusal(ELEVENLABS_PROVIDER, "auth_refused", detail, cause), "not_sent")
        case ElevenlabsErrorCode.NotFound:
            return withProof(providerRefusal(ELEVENLABS_PROVIDER, "not_found", detail, cause), "not_sent")
        case ElevenlabsErrorCode.Rejected:
            return withProof(providerRefusal(ELEVENLABS_PROVIDER, "rejected", detail, cause), "not_sent")
        case ElevenlabsErrorCode.RateLimited:
            return withProof(cause, "not_sent")
        case ElevenlabsErrorCode.Unreachable:
        case ElevenlabsErrorCode.Failed:
        case ElevenlabsErrorCode.Malformed:
            return withProof(cause, "unknown")
    }
}
