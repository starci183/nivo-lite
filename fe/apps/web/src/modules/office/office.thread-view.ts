import type { OfficeThreadItem } from "@/modules/types"
import { exceptionView } from "./office.exception-view"
import { approvalView, commandView, dayLabelOf, messageView } from "./office.message-view"
import type { ThreadEntry } from "./office.thread"
import type { OfficeContext, OfficeWords } from "./office.words"

/** The words and the cards of every entry of the thread. */
export const threadViewsOf = (
    entries: ReadonlyArray<ThreadEntry>,
    words: OfficeWords,
    context: OfficeContext,
): ReadonlyArray<OfficeThreadItem> =>
    entries.map((entry): OfficeThreadItem => {
        if (entry.kind === "day")
            return { kind: "day", key: entry.key, label: dayLabelOf(entry.dayKey, words, context) }
        if (entry.kind === "approval") return approvalView(entry.approval, words, context)
        if (entry.kind === "exception") return exceptionView(entry.work, words, context)
        if (entry.kind === "command") return commandView(entry.candidate, words, context)
        return messageView(entry, words, context)
    })
