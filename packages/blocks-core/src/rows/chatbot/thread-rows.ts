import { textOf, valueAt } from "../../slots/paths"

/** Where a conversation stands in the inbox, as the list marks it. */
export type ThreadStatus = "needs" | "handled" | "ai"

/** One conversation of the inbox list as the block draws it. */
export interface ThreadListRow {
    /** The key of the row; a record without one draws no row. */
    readonly id: string
    /** The name of the customer; the words for an unnamed visitor when the record has none. */
    readonly name: string
    /** The last words of the conversation, led by who said them; empty when there are none. */
    readonly preview: string
    /** When the conversation last moved, as the ISO 8601 text of the record; empty when it has none. */
    readonly at: string
    /** Where the conversation stands; null when the record names no known state. */
    readonly status: ThreadStatus | null
    /** The person who holds the conversation; empty while the AI answers. */
    readonly handledBy: string
    /** The key of the channel the customer writes from; empty when unknown. */
    readonly channel: string
}

/** The words of a row that are not the conversation's own. */
export interface ThreadRowWords {
    /** The name of a visitor the inbox does not know yet. */
    readonly untitled: string
    /** The lead of a last line a person wrote. */
    readonly byPerson: string
    /** The lead of a last line the AI wrote. */
    readonly byAi: string
}

const STATUSES: ReadonlyArray<ThreadStatus> = ["needs", "handled", "ai"]
/** The status a text names; null when it names none. */
export const threadStatusOf = (text: string): ThreadStatus | null => STATUSES.find((status) => status === text) ?? null

/** The last words with who said them: the customer's as they are, the agent's led by the AI or the person holding the thread. */
const previewOf = (record: unknown, handledBy: string, words: ThreadRowWords): string => {
    const text = textOf(valueAt(record, "lastText"))
    if (text === "") return ""
    if (textOf(valueAt(record, "lastRole")) !== "agent") return text
    return `${handledBy === "" ? words.byAi : words.byPerson}${text}`
}

/** The row of one record; a record without a text id draws none. */
const rowOf = (record: unknown, words: ThreadRowWords): ReadonlyArray<ThreadListRow> => {
    const id = textOf(valueAt(record, "id"))
    if (id === "") return []
    const handledBy = textOf(valueAt(record, "handledBy"))
    return [
        {
            id,
            name: textOf(valueAt(record, "name")) || words.untitled,
            preview: previewOf(record, handledBy, words),
            at: textOf(valueAt(record, "lastAt")),
            status: threadStatusOf(textOf(valueAt(record, "status"))),
            handledBy,
            channel: textOf(valueAt(record, "channel")),
        },
    ]
}

/** The rows of a bound list of conversations, or null when none can be drawn, which the block reads as an empty slot. */
export const threadRowsOf = (
    records: ReadonlyArray<unknown>,
    words: ThreadRowWords,
): ReadonlyArray<ThreadListRow> | null => {
    const rows = records.flatMap((record) => rowOf(record, words))
    return rows.length === 0 ? null : rows
}

/** The tabs of the inbox: every conversation, the ones that wait for a person, and the ones that moved today. */
export const INBOX_TABS: ReadonlyArray<string> = ["needs", "today"]
