import { ToolsError, ToolsErrorCode, type RefusalClass } from "@modules/domain/tools"
import { providerRefusalReason, type ProviderRefusalReason } from "@modules/domain/provider-registry"

/**
 * Every refusal a destination (domain) publishing tool answers (`nivo.tool.facebook.*`, `nivo.tool.instagram.*`, `nivo.tool.tiktok.*`,
 * `nivo.tool.youtube.*`), whichever provider account served it: `not_connected` (no account handed, or no credential), `connection_refused`
 * (the platform refused the credential), `rejected` (the platform refused the content or the request and did nothing), `not_found`
 * (the post, container, video or publish id is not there), `not_available` (an operation not built: its documentation could not be read).
 */
export const SOCIAL_REFUSALS = ["not_connected", "connection_refused", "rejected", "not_found", "not_available"] as const

/** One refusal of a publishing tool. */
export type SocialRefusalReason = (typeof SOCIAL_REFUSALS)[number]

/** What each refusal IS (a TOTAL record): `business` is an answer a node reads and goes on from; `infrastructure` freezes the step. */
export const SOCIAL_REFUSAL_CLASS: Readonly<Record<SocialRefusalReason, RefusalClass>> = {
    not_connected: "infrastructure",
    connection_refused: "infrastructure",
    rejected: "business",
    not_found: "business",
    not_available: "infrastructure",
}

/** The business refusals the tool registry lists for a publishing tool. */
export const SOCIAL_BUSINESS_REFUSALS: readonly ["rejected", "not_found"] = ["rejected", "not_found"] as const satisfies ReadonlyArray<SocialRefusalReason>

const REASON_OF_PROVIDER: Readonly<Record<ProviderRefusalReason, SocialRefusalReason>> = {
    rejected: "rejected",
    not_found: "not_found",
    auth_refused: "connection_refused",
    no_credential: "not_connected",
    not_available: "not_available",
}

/** The refusal a publishing tool throws for an expected case; the gateway turns it into a `tool_error` answer. */
export const socialRefusal = (reason: SocialRefusalReason, cause?: unknown): ToolsError =>
    new ToolsError({
        code: ToolsErrorCode.NativeRefused,
        params: { reason, refusalClass: SOCIAL_REFUSAL_CLASS[reason] },
        ...(cause === undefined ? {} : { cause }),
    })

/** A provider's refusal as the tool's own; any other failure as it is (the step's freeze reads what it proves). */
export const socialFailureOf = (cause: unknown): unknown => {
    const reason = providerRefusalReason(cause)
    return reason === null ? cause : socialRefusal(REASON_OF_PROVIDER[reason], cause)
}
