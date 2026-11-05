/** Whose message it is: the viewer's own, someone else's, or a line the system adds to the thread. */
export type MessageSide = "incoming" | "outgoing" | "notice"

/** How far a message the viewer sent has travelled. */
export type DeliveryState = "queued" | "sent" | "failed" | "unknown"

/** One message of a thread as the block draws it. */
export interface MessageRow {
    /** The key the thread draws the message under; a record without one draws no message. */
    readonly id: string
    /** Who wrote it; empty draws no author line. */
    readonly author: string
    /** The words of the message. */
    readonly text: string
    /** Whose message it is. */
    readonly side: MessageSide
    /** The moment it was written, as milliseconds; null when the record carries no valid time. */
    readonly atMs: number | null
    /** The short marker beside the author; empty draws none. */
    readonly mark: string
    /** How far a message of the viewer has travelled; null draws no mark. */
    readonly delivery: DeliveryState | null
}

/** The dotted paths of a record that name the parts of its message. */
export interface MessagePaths {
    /** The path of the text that identifies the message. */
    readonly idPath: string
    /** The path of the words of the message. */
    readonly textPath: string
    /** The path of the author's name; absent draws no author line. */
    readonly authorPath?: string | undefined
    /** The path of the time the message was written, as an ISO 8601 text. */
    readonly timePath?: string | undefined
    /** The path of the delivery state of a message of the viewer. */
    readonly statusPath?: string | undefined
    /** The path of whose message it is: `incoming`, `outgoing` or `notice`; absent makes every message incoming. */
    readonly sidePath?: string | undefined
    /** The path of the short marker beside the author. */
    readonly markPath?: string | undefined
}

/** One entry of the thread: a day divider, or a message with the part of its anatomy grouping decides. */
export type ThreadEntry =
    | {
          readonly kind: "day"
          /** The key of the entry. */
          readonly id: string
          /** A moment of the day, as milliseconds. */
          readonly atMs: number
      }
    | {
          readonly kind: "message"
          /** The key of the entry. */
          readonly id: string
          /** The message. */
          readonly row: MessageRow
          /** Whether it continues the group of the message before it, so the author and the avatar are left out. */
          readonly isContinuation: boolean
      }

/** The name of a day in the thread: today and yesterday have words of their own, any other day its date. */
export interface DayName {
    /** Which of the two named days it is; null for any other day. */
    readonly relative: "today" | "yesterday" | null
    /** The date in the language of the viewer. */
    readonly formatted: string
}

/** A message the viewer wrote that the server has not confirmed yet. */
export interface PendingSend {
    /** The key of the pending message in the thread. */
    readonly key: string
    /** The words that were sent. */
    readonly text: string
    /** The id of the last message the thread held when the message was written; the thread has caught up once that changes. */
    readonly afterId: string | null
    /** Whether the send is in flight, failed (retry in place) or done and waiting for the thread to catch up. */
    readonly state: "sending" | "failed" | "sent"
}

/** What happens to the pending messages of a thread. */
export type PendingAction =
    | { readonly type: "queue"; readonly key: string; readonly text: string; readonly afterId: string | null }
    | { readonly type: "retry"; readonly key: string }
    | { readonly type: "fail"; readonly key: string }
    | { readonly type: "done"; readonly key: string }
    | { readonly type: "discard"; readonly key: string }
    | { readonly type: "settle"; readonly lastId: string | null }
