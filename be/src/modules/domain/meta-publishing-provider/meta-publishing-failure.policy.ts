import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { MetaPublishingError, MetaPublishingErrorCode } from "@modules/integrations/meta-publishing"

/** The provider key of the Meta account (Facebook Pages and the linked Instagram account): it reaches the domains `facebook` and `instagram`. */
export const META_PROVIDER: typeof PROVIDER.meta = PROVIDER.meta

/**
 * A failure of the Meta publishing client as the destination ports throw it, with what it proves by WHERE it failed: an answered refusal
 * (a credential or permission error, a 404, any other refusal, or an id NIVO would not send) is a `providerRefusal` proving no effect
 * (`not_sent`); a rate limit is rethrown as it is, proving no effect; a transport failure, an outage answer or an unreadable success may
 * have acted (`unknown`). Anything else proves nothing.
 */
export const metaPublishingFailureOf = (cause: unknown): unknown => {
    if (!(cause instanceof MetaPublishingError)) return cause
    const detail = typeof cause.params.detail === "string" && cause.params.detail !== "" ? cause.params.detail : null
    switch (cause.code) {
        case MetaPublishingErrorCode.AuthFailed:
            return withProof(providerRefusal(META_PROVIDER, "auth_refused", detail, cause), "not_sent")
        case MetaPublishingErrorCode.NotFound:
            return withProof(providerRefusal(META_PROVIDER, "not_found", detail, cause), "not_sent")
        case MetaPublishingErrorCode.Rejected:
            return withProof(providerRefusal(META_PROVIDER, "rejected", detail, cause), "not_sent")
        case MetaPublishingErrorCode.RateLimited:
            return withProof(cause, "not_sent")
        case MetaPublishingErrorCode.Unreachable:
        case MetaPublishingErrorCode.Failed:
        case MetaPublishingErrorCode.Malformed:
            return withProof(cause, "unknown")
    }
}
