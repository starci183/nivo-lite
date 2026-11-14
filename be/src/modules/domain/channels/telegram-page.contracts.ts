import type { ConnectionAttention } from "@modules/domain/connections"
/** The page of one Telegram bot connection; the token never leaves. */
export interface TelegramPageView {
    /** The connection id. */
    readonly id: string
    /** The name the owner gave. */
    readonly name: string
    /** The status of the connection. */
    readonly status: string
    /** True when the connection is connected and reports no error. */
    readonly healthy: boolean
    /** What the connection asks of its owner beyond its status: `needs_reauth` (the provider refused the credential: connect again), `degraded` (connected, yet the provider cannot be read at the moment), or null. */
    readonly attention: ConnectionAttention | null
    /** The bot's username, or an empty text. */
    readonly botUsername: string
    /** The webhook address NIVO registered with Telegram; shown, never pasted. */
    readonly webhookUrl: string
    /** The code of the last failure, which the page words, or null. */
    readonly lastError: string | null
    /** When the last event arrived, ISO 8601, or null. */
    readonly lastEventAt: string | null
    /** The agents that use the connection. */
    readonly agentIds: ReadonlyArray<string>
}
