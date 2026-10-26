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
 * The line that carries the status: the one the back end attached its receipt to, when it is my bubble (it stays there while
 * others post newer lines), otherwise my last bubble, which then reads as sent.
 */
const statusTargetOf = (items: ReadonlyArray<OfficeThreadItem>, entries: ReadonlyArray<ThreadEntry>): number => {
    const receipted = entries.findIndex((entry) => entry.kind === "message" && entry.message.receipt !== null)
    const receiptItem = items[receipted]
    return receiptItem !== undefined && isMyBubble(receiptItem) ? receipted : items.findLastIndex(isMyBubble)
}

/**
 * The words and the cards of every entry of the thread; one line of mine, and only it, carries its delivery status
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
    const target = statusTargetOf(items, entries)
    const item = items[target]
    const entry = entries[target]
    if (hasOutbox || item?.kind !== "message" || entry?.kind !== "message") return items
    return items.map((candidate, index) =>
        index === target ? { ...item, status: messageStatusOf(entry.message.receipt, words) } : candidate,
    )
}
