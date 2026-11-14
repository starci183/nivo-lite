import type { OptionalRenderCallback, OptionalRenderWebhook } from "./video-compose.contracts"

/** The path of NIVO's render door (the HTTP route `POST /api/connections/video-render/:provider/:connectionId/:token`). */
export const RENDER_DOOR_PATH = "api/connections/video-render"

/** What a callback is formed of: the public origin (null on a local stack), the provider, its webhook, the connection and its secret. */
export interface RenderCallbackInput {
    /** The public https origin, or null on a local stack. */
    readonly origin: string | null
    /** The provider key. */
    readonly provider: string
    /** The provider's webhook, or null when it has none. */
    readonly webhook: OptionalRenderWebhook
    /** The connection. */
    readonly connectionId: string
    /** The connection's own webhook secret, or null when it holds none. */
    readonly webhookSecret: string | null
}

/** The origin without its trailing slashes. */
const trimmedOrigin = (origin: string): string => {
    let end = origin.length
    while (end > 0 && origin[end - 1] === "/") end -= 1
    return origin.slice(0, end)
}

/**
 * Where a provider calls back for one connection's renders: the public https origin, the provider, the connection and the connection's
 * own webhook secret as the last segment (the door proves it in constant time before anything is read). Null without a public origin (a
 * local stack: the run's wait times out and reads the render by `statusOf`), for a provider with no webhook, or with no secret. Pure.
 */
export const renderCallbackOf = (input: RenderCallbackInput): OptionalRenderCallback => {
    const { origin, webhook, webhookSecret } = input
    if (origin === null || webhook === null || webhookSecret === null || webhookSecret === "") return null
    const parts = [input.provider, input.connectionId, webhookSecret].map((part) => encodeURIComponent(part)).join("/")
    return { url: `${trimmedOrigin(origin)}/${RENDER_DOOR_PATH}/${parts}` }
}
