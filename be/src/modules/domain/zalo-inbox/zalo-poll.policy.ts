import { ZALO_FREE_WINDOW_MS } from "@modules/domain/channels"
import type { PolledZaloMessage } from "./zalo-inbox.contracts"
import type { ZaloInboxOptions } from "./zalo-inbox.options"

const DAY_MS = 86_400_000

/** The reconcile rules with every default filled in. */
export type ZaloPollRules = Required<ZaloInboxOptions>

/** Zalo lets the OA reply as a consultation message for 48 hours after the customer's last message; a day-old message is stale for an agent; a connection's first run reads 7 days back. */
export const ZALO_POLL_DEFAULTS: ZaloPollRules = {
    replyWindowMs: ZALO_FREE_WINDOW_MS,
    staleAfterMs: DAY_MS,
    backfillMs: 7 * DAY_MS,
}

/** How many conversations or messages one Zalo list call reads (the most the open API allows). */
export const ZALO_POLL_PAGE_SIZE = 10

/** The most pages one list is walked, so a run is bounded. */
export const ZALO_POLL_MAX_PAGES = 30

/** The pause between two Zalo calls, in milliseconds, to stay inside the rate limit of the open API. */
export const ZALO_POLL_PAUSE_MS = 400

/** The public fact of a connection that holds the sent time of the newest customer message the run has seen. */
const CURSOR_KEY = "zalo_inbox_cursor"

/** The rules the options give, the defaults where they give none. */
export const pollRulesOf = (options: ZaloInboxOptions): ZaloPollRules => ({ ...ZALO_POLL_DEFAULTS, ...options })

/**
 * True when a message must not be answered by an agent: it is older than the reply window (Zalo would refuse or charge the reply) or older
 * than the stale age (the customer has long stopped waiting), whichever is shorter.
 */
export const isStaleMessage = (sentAt: number, now: number, rules: ZaloPollRules): boolean =>
    now - sentAt > Math.min(rules.replyWindowMs, rules.staleAfterMs)

/** The instant of the newest customer message a connection's last run saw, or undefined before its first run (or when the fact is damaged). */
export const cursorOf = (meta: Readonly<Record<string, string>>): number | undefined => {
    const stamp = Date.parse(meta[CURSOR_KEY] ?? "")
    return Number.isNaN(stamp) ? undefined : stamp
}

/** The connection facts with the cursor moved to `seenAt`. */
export const metaWithCursor = (meta: Readonly<Record<string, string>>, seenAt: number): Record<string, string> => ({
    ...meta,
    [CURSOR_KEY]: new Date(seenAt).toISOString(),
})

/** Where a run starts reading: the cursor, else the backfill window back from now. */
export const windowStartOf = (cursor: number | undefined, now: number, rules: ZaloPollRules): number =>
    cursor ?? now - rules.backfillMs

/** The body the webhook would have posted for this message, so the inbox claims it under the same delivery id and the consumer reads it like any delivery. */
export const polledRawBody = (message: PolledZaloMessage): Buffer =>
    Buffer.from(
        JSON.stringify({
            event_name: "user_send_text",
            timestamp: String(message.sentAt),
            sender: { id: message.userId },
            message: { msg_id: message.messageId, text: message.text },
        }),
    )
