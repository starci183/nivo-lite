import { dayNameOf, timeLabelOf } from "./conversation"
import type { DeliveryState, ThreadEntry } from "./conversation.types"

/** The words of the thread that are not the messages: the names of two days and the marks of delivery. */
export interface ThreadWords {
    /** The name of the current day. */
    readonly today: string
    /** The name of the day before. */
    readonly yesterday: string
    /** The mark of each delivery state. */
    readonly delivery: Readonly<Record<DeliveryState, string>>
}

/** Where and when the thread is read. */
export interface ThreadClock {
    /** The language of the viewer. */
    readonly locale: string
    /** The time zone of the viewer; undefined is the one of the runtime. */
    readonly zone: string | undefined
    /** Now, as milliseconds. */
    readonly nowMs: number
}

/** One entry of the thread with every word resolved, ready for the component that draws it. */
export type ThreadViewEntry =
    | {
          readonly kind: "day"
          readonly id: string
          /** The name of the day. */
          readonly label: string
      }
    | {
          readonly kind: "notice"
          readonly id: string
          /** The line the system adds to the thread. */
          readonly text: string
      }
    | {
          readonly kind: "message"
          readonly id: string
          /** Whose message it is. */
          readonly side: "incoming" | "outgoing"
          /** The author line; empty when the message continues the group before it. */
          readonly author: string
          /** The words of the message. */
          readonly text: string
          /** The time of day; empty when the message has none. */
          readonly meta: string
          /** The short marker beside the author; empty draws none. */
          readonly mark: string
          /** The face of an outgoing bubble: the soft tint for the AI speaking for the reader, the brand fill for the reader's own words. */
          readonly tone: "brand" | "soft"
          /** Whether the author's avatar stands beside the message. */
          readonly hasAvatar: boolean
          /** How far the message has travelled, with its words; null draws no mark. */
          readonly delivery: { readonly state: DeliveryState; readonly label: string } | null
          /** Whether the message failed to send and offers a retry in place. */
          readonly canRetry: boolean
      }

/** The thread entries with their words: day names, times of day, delivery marks, and which failed message offers a retry. */
export const threadViewOf = (
    entries: ReadonlyArray<ThreadEntry>,
    words: ThreadWords,
    clock: ThreadClock,
    retryable: ReadonlySet<string>,
): ReadonlyArray<ThreadViewEntry> =>
    entries.map((entry): ThreadViewEntry => {
        if (entry.kind === "day") {
            const day = dayNameOf(entry.atMs, clock.nowMs, clock.locale, clock.zone)
            const label = day.relative === null ? day.formatted : words[day.relative]
            return { kind: "day", id: entry.id, label }
        }
        const { row } = entry
        if (row.side === "notice") return { kind: "notice", id: entry.id, text: row.text }
        return {
            kind: "message",
            id: entry.id,
            side: row.side,
            author: entry.isContinuation ? "" : row.author,
            text: row.text,
            meta: timeLabelOf(row.atMs, clock.locale, clock.zone),
            mark: entry.isContinuation ? "" : row.mark,
            tone: row.side === "outgoing" && row.mark !== "" ? "soft" : "brand",
            hasAvatar: row.side === "incoming" && !entry.isContinuation && row.author !== "",
            delivery: row.delivery === null ? null : { state: row.delivery, label: words.delivery[row.delivery] },
            canRetry: row.delivery === "failed" && retryable.has(entry.id),
        }
    })
