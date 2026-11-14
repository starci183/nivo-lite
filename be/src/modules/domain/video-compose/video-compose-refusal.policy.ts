import { ToolsError, ToolsErrorCode, type RefusalClass } from "@modules/domain/tools"
import { providerRefusalDetail, providerRefusalReason, type ProviderRefusalReason } from "@modules/domain/provider-registry"

/**
 * Every refusal the compose tools answer, whichever provider served the call: `invalid_spec` (the spec breaks a rule across its members,
 * nothing was sent), `provider_refused` (the provider refused the spec as asked: a capability it lacks or its validation; its words ride
 * in `detail`), `not_found` (the render is not at the account), `not_connected` (no account handed, or no credential), `connection_refused`
 * (the provider refused the credential), `not_available` (the operation is not built). The engine's own refusals of the rights
 * (`not_attached`, `node_mode_unknown`) are the door's, never these.
 */
export const VIDEO_COMPOSE_REFUSALS = [
    "invalid_spec",
    "provider_refused",
    "not_found",
    "not_connected",
    "connection_refused",
    "not_available",
] as const

/** One refusal of a compose tool. */
export type VideoComposeRefusalReason = (typeof VIDEO_COMPOSE_REFUSALS)[number]

/**
 * What each refusal IS (a TOTAL record): `business`, an answer about the request a node goes on from (the spec, the provider's verdict
 * on it, a render not there); `infrastructure`, what only the owner or the engine cures (an account, its credential, an operation not
 * built): the step freezes and is reported.
 */
export const VIDEO_COMPOSE_REFUSAL_CLASS: Readonly<Record<VideoComposeRefusalReason, RefusalClass>> = {
    invalid_spec: "business",
    provider_refused: "business",
    not_found: "business",
    not_connected: "infrastructure",
    connection_refused: "infrastructure",
    not_available: "infrastructure",
}

/** The business refusals of `nivo.tool.video.compose` (the SDK's `VideoComposeRefusal`, the closed set of its `TOOL_SPECS` entry). */
export const VIDEO_COMPOSE_BUSINESS_REFUSALS: ReadonlyArray<VideoComposeRefusalReason> = ["invalid_spec", "provider_refused"]

/** The business refusals of `nivo.tool.video.render.get` (the SDK's `VideoRenderGetRefusal`). */
export const VIDEO_RENDER_GET_BUSINESS_REFUSALS: ReadonlyArray<VideoComposeRefusalReason> = ["not_found"]

/** The compose refusal of each reason a provider adapter proves. */
const REASON_OF_PROVIDER: Readonly<Record<ProviderRefusalReason, VideoComposeRefusalReason>> = {
    rejected: "provider_refused",
    not_found: "not_found",
    auth_refused: "connection_refused",
    no_credential: "not_connected",
    not_available: "not_available",
}

/** The refusal a compose tool throws for an expected case; the gateway answers it as a `tool_error`, the cause kept for the log. */
export const composeRefusal = (reason: VideoComposeRefusalReason, detail?: string, cause?: unknown): ToolsError =>
    new ToolsError({
        code: ToolsErrorCode.NativeRefused,
        params: {
            reason,
            refusalClass: VIDEO_COMPOSE_REFUSAL_CLASS[reason],
            ...(detail === undefined || detail === "" ? {} : { detail }),
        },
        ...(cause === undefined ? {} : { cause }),
    })

/** A provider's refusal as the compose tool's own (its words kept as `detail`); any other failure as it is, with what it proves. */
export const composeFailureOf = (cause: unknown): unknown =>
    {
    const reason = providerRefusalReason(cause)
    return reason === null ? cause : composeRefusal(REASON_OF_PROVIDER[reason], providerRefusalDetail(cause) ?? undefined, cause)
}
