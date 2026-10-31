import type { MessageEventRow } from "./persistence/zalo-page.rows"
import type { TelegramPageEvent } from "./telegram-page.contracts"
import { EVENTS_MAX } from "./connection-events.policy"

const SHOWN_HEAD = 4
const SHOWN_TAIL = 3
const ELLIPSIS = "…"

/** A chat id with its middle hidden (`6201…118`); an id too short to hide anything shows nothing. */
export const maskedChatOf = (externalId: string | null): string => {
    if (externalId === null || externalId.length <= SHOWN_HEAD + SHOWN_TAIL) return ""
    return `${externalId.slice(0, SHOWN_HEAD)}${ELLIPSIS}${externalId.slice(-SHOWN_TAIL)}`
}

const eventOf = (row: MessageEventRow): TelegramPageEvent => {
    const at = new Date(row.created_at).toISOString()
    const who = row.visitor_name ?? ""
    if (row.role === "user") return { id: row.id, kind: "user_message", outcome: "received", at, who, reason: null }
    const failed = row.delivery_status === "failed"
    return {
        id: row.id,
        kind: "agent_reply",
        outcome: failed ? "not_sent" : "sent",
        at,
        who,
        reason: failed ? (row.delivery_error ?? "delivery_failed") : null,
    }
}

/** The live panel: customer messages and agent replies, newest first, without any text. */
export const telegramEventsOf = (rows: ReadonlyArray<MessageEventRow>): ReadonlyArray<TelegramPageEvent> =>
    rows
        .map(eventOf)
        .toSorted((a, b) => b.at.localeCompare(a.at))
        .slice(0, EVENTS_MAX)
