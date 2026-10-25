import type { OfficeThreadItem } from "@/modules/types"
import { exceptionView } from "./office.exception-view"
import { approvalView, commandView, dayLabelOf, messageView } from "./office.message-view"
import { resultCardView } from "./office.rooms"
import { messageStatusOf } from "./office.status"
import type { ThreadEntry } from "./office.thread"
import type { OfficeContext, OfficeWords } from "./office.words"

const isMyBubble = (item: OfficeThreadItem): boolean =>
    item.kind === "message" && item.variant === "bubble" && item.side === "outgoing"

/**
 * The words and the cards of every entry of the thread; my last line, and only it, carries its delivery status
 * (none while a line waits to send, since that one is then the last).
 */
export const threadViewsOf = (
    entries: ReadonlyArray<ThreadEntry>,
    words: OfficeWords,
    context: OfficeContext,
    hasOutbox: boolean,
): ReadonlyArray<OfficeThreadItem> => {
    const items = entries.map((entry): OfficeThreadItem => {
        if (entry.kind === "day")
            return { kind: "day", key: entry.key, label: dayLabelOf(entry.dayKey, words, context) }
        if (entry.kind === "approval") return approvalView(entry.approval, words, context)
        if (entry.kind === "exception") return exceptionView(entry.work, words, context)
        if (entry.kind === "command") return commandView(entry.candidate, words, context)
        if (entry.kind === "card") return resultCardView(entry, words, context)
        return messageView(entry, words, context)
    })
    const lastMine = items.findLastIndex(isMyBubble)
    const item = items[lastMine]
    const entry = entries[lastMine]
    if (hasOutbox || item?.kind !== "message" || entry?.kind !== "message") return items
    return items.map((candidate, index) =>
        index === lastMine ? { ...item, status: messageStatusOf(entry.message.receipt, words) } : candidate,
    )
}
