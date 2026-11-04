/** One received input as the Inbox panes draw it, every word already in the reader's language. */
export interface InboxRowView {
    readonly id: string
    /** The heading of the opened input: what it is and who it is from. */
    readonly title: string
    /** The person or system that sent it; names the row. */
    readonly sender: string
    /** The channel it arrived on. */
    readonly source: string
    /** What it is: a message, an order or a payment. */
    readonly kind: string
    /** The raw channel and kind words of the data, for the row glyph. */
    readonly channelKey: string
    readonly kindKey: string
    /** The age: long for the opened input ("5 min ago"), short for the row ("5 min"). */
    readonly ago: string
    readonly agoShort: string
    readonly status: { readonly label: string; readonly tone: "neutral" | "success" | "warning" | "danger" }
    /** What was said, or empty for an input that is not a message. */
    readonly body: string
    /** The one line under the sender in the list. */
    readonly line: string
    /** Sender, contact, channel, kind, time, amount and reference lines of the opened input. */
    readonly details: ReadonlyArray<{ readonly key: string; readonly term: string; readonly text: string }>
    /** How many repeats of the same event were blocked. */
    readonly duplicates: number
    readonly lead: { readonly href: string; readonly label: string } | null
    readonly office: { readonly href: string; readonly label: string } | null
}
