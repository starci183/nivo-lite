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

/** The kinds of line the live panel lists. */
export type TelegramEventKind = "user_message" | "agent_reply"

/** What happened to the event. */
export type TelegramEventOutcome = "received" | "sent" | "not_sent"

/** One line of the live Telegram events panel; it carries no message text. */
export interface TelegramPageEvent {
    /** A stable id of the line. */
    readonly id: string
    /** The kind. */
    readonly kind: TelegramEventKind
    /** What happened to it. */
    readonly outcome: TelegramEventOutcome
    /** When, ISO 8601. */
    readonly at: string
    /** The customer's chat id with its middle hidden, or an empty text. */
    readonly who: string
    /** Why a reply was not sent, in the stable terms of the delivery path; null otherwise. */
    readonly reason: string | null
}
