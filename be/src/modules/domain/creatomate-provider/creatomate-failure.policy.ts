import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { CreatomateError, CreatomateErrorCode } from "@modules/integrations/creatomate"

/** The provider key of Creatomate. */
export const CREATOMATE_PROVIDER: string = PROVIDER.creatomate

/**
 * A failure of the Creatomate client as the generic port throws it, with what it proves by WHERE it failed: an answered refusal (401/403,
 * 404, any other 4xx such as 400 or 402 out of credits, or an argument NIVO would not send) is a `providerRefusal` proving no effect
 * (`not_sent`), the `hint` of Creatomate as its words; a rate limit is rethrown as it is, proving no effect (the runner then falls back
 * to the next compose account); a transport failure, a 5xx or an unreadable success may have acted (`unknown`). Anything else proves nothing.
 */
export const creatomateFailureOf = (cause: unknown): unknown => {
    if (!(cause instanceof CreatomateError)) return cause
    const detail = typeof cause.params.detail === "string" && cause.params.detail !== "" ? cause.params.detail : null
    switch (cause.code) {
        case CreatomateErrorCode.AuthFailed:
            return withProof(providerRefusal(CREATOMATE_PROVIDER, "auth_refused", detail, cause), "not_sent")
        case CreatomateErrorCode.NotFound:
            return withProof(providerRefusal(CREATOMATE_PROVIDER, "not_found", detail, cause), "not_sent")
        case CreatomateErrorCode.Rejected:
            return withProof(providerRefusal(CREATOMATE_PROVIDER, "rejected", detail, cause), "not_sent")
        case CreatomateErrorCode.RateLimited:
            return withProof(cause, "not_sent")
        case CreatomateErrorCode.Unreachable:
        case CreatomateErrorCode.Failed:
        case CreatomateErrorCode.Malformed:
            return withProof(cause, "unknown")
    }
}
