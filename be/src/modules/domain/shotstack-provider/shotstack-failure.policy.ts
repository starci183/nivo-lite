import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { ShotstackError, ShotstackErrorCode } from "@modules/integrations/shotstack"

/** The provider key of Shotstack. */
export const SHOTSTACK_PROVIDER: string = PROVIDER.shotstack

/**
 * A failure of the Shotstack client as the compose port throws it, with what it proves by WHERE it failed: an answered refusal (401/403,
 * 404, any other 4xx, or an argument NIVO would not send) is a `providerRefusal` proving no effect (`not_sent`), carrying Shotstack's
 * words; a rate limit is rethrown as it is, proving no effect (the ToolRunner falls back to the next compose account); a transport
 * failure, a 5xx or an unreadable success may have rendered (`unknown`). Anything else proves nothing.
 */
export const shotstackFailureOf = (cause: unknown): unknown => {
    if (!(cause instanceof ShotstackError)) return cause
    const detail = typeof cause.params.detail === "string" && cause.params.detail !== "" ? cause.params.detail : null
    switch (cause.code) {
        case ShotstackErrorCode.AuthFailed:
            return withProof(providerRefusal(SHOTSTACK_PROVIDER, "auth_refused", detail, cause), "not_sent")
        case ShotstackErrorCode.NotFound:
            return withProof(providerRefusal(SHOTSTACK_PROVIDER, "not_found", detail, cause), "not_sent")
        case ShotstackErrorCode.Rejected:
            return withProof(providerRefusal(SHOTSTACK_PROVIDER, "rejected", detail, cause), "not_sent")
        case ShotstackErrorCode.RateLimited:
            return withProof(cause, "not_sent")
        case ShotstackErrorCode.Unreachable:
        case ShotstackErrorCode.Failed:
        case ShotstackErrorCode.Malformed:
            return withProof(cause, "unknown")
    }
}
