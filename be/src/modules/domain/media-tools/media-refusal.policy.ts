import { ToolsError, ToolsErrorCode, type RefusalClass } from "@modules/domain/tools"
import { providerRefusalReason, type MediaToolRefusal, type ProviderRefusalReason } from "@modules/domain/provider-registry"

/**
 * The expected refusals of a generic media tool (`nivo.tool.speech.*`, `nivo.tool.dubbing.*`, `nivo.tool.video.*`): an answer to the
 * caller, never a failure of the connector. Every provider's refusal maps onto these, so a node reads the same words whichever provider
 * served the call. The list is the port contracts' `MEDIA_TOOL_REFUSALS` (the engine's tool registry states it from there).
 */
/**
 * What each refusal IS (a TOTAL record): `business`, an answer about the request a node may go on from (the provider refused its
 * content, the voice or the job is not there); `infrastructure`, what only the owner or the engine cures (no account handed or no
 * credential, a refused credential, an operation not built, no file store bound); the step freezes and is reported.
 */
export const MEDIA_REFUSAL_CLASS: Readonly<Record<MediaToolRefusal, RefusalClass>> = {
    not_connected: "infrastructure",
    connection_refused: "infrastructure",
    rejected: "business",
    not_found: "business",
    not_available: "infrastructure",
    file_store_unavailable: "infrastructure",
}

/** The refusal of a provider's reason. */
const REASON_OF_PROVIDER: Readonly<Record<ProviderRefusalReason, MediaToolRefusal>> = {
    rejected: "rejected",
    not_found: "not_found",
    auth_refused: "connection_refused",
    no_credential: "not_connected",
    not_available: "not_available",
}

/** The refusal a media tool throws for an expected case; the gateway turns it into a `tool_error` answer, the cause kept for the log. */
export const mediaRefusal = (reason: MediaToolRefusal, cause?: unknown): ToolsError =>
    new ToolsError({
        code: ToolsErrorCode.NativeRefused,
        params: { reason, refusalClass: MEDIA_REFUSAL_CLASS[reason] },
        ...(cause === undefined ? {} : { cause }),
    })

/** A provider's refusal as the media tool's own; any other failure as it is (a retry or the step's freeze reads it). */
export const mediaFailureOf = (cause: unknown): unknown => {
    const reason = providerRefusalReason(cause)
    return reason === null ? cause : mediaRefusal(REASON_OF_PROVIDER[reason], cause)
}
