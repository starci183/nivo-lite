import type { ConnectionTone } from "@/modules/types"

/** How often the live panel asks for newer events. */
export const TELEGRAM_EVENTS_POLL_MS = 5000

/** How often the page asks again while the connection needs attention. */
export const TELEGRAM_PAGE_POLL_MS = 8000

/** The setup steps of the page of one Telegram bot, in the order the back end does them. */
export type TelegramStepId = "bot" | "webhook" | "check" | "agents"

/** What the status chip says: the bot works, it needs a look, or it was disconnected. */
export type TelegramStatusKind = "ok" | "check" | "off"

/** The status kind of a connection: a healthy bot works, a disconnected one is off, anything else needs a look. */
export const telegramStatusKindOf = (healthy: boolean, status: string): TelegramStatusKind => {
    if (healthy) return "ok"
    return status === "disconnected" ? "off" : "check"
}

/** The tone of the status chip. */
export const telegramChipToneOf = (kind: TelegramStatusKind): ConnectionTone => {
    if (kind === "ok") return "success"
    return kind === "off" ? "neutral" : "danger"
}

/** The code the back end stores when Telegram refuses the webhook address. */
export const WEBHOOK_REFUSED_CODE = "CHANNEL_CONNECTIONS_WEBHOOK_REFUSED"

/** The code the back end stores when Telegram does not know the token. */
export const TOKEN_REJECTED_CODE = "CHANNEL_CONNECTIONS_TOKEN_REJECTED"

/** What a setup step needs from the page to say whether it is done. */
interface TelegramStepFacts {
    readonly healthy: boolean
    readonly agentCount: number
}

/** The setup steps in back end order, each true once the page shows it done. The bot is created and the token pasted before the page exists. */
export const telegramStepsDone = (facts: TelegramStepFacts): ReadonlyArray<readonly [TelegramStepId, boolean]> => [
    ["bot", true],
    ["webhook", facts.healthy],
    ["check", facts.healthy],
    ["agents", facts.agentCount > 0],
]

/** The step a page opens on: the first one not done, or none when every step is done. */
export const firstOpenTelegramStep = (done: ReadonlyArray<readonly [TelegramStepId, boolean]>): TelegramStepId | null =>
    done.find(([, isDone]) => !isDone)?.[0] ?? null
