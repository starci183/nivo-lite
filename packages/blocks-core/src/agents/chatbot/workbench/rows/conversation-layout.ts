/** The width of a pane of the conversation: a rail of the grammar, or the free space. */
export type ConversationTrack = "standard" | "fill"

/** What the panes of a conversation are: the list of threads, the open thread, the contact beside it. */
export interface ConversationPanes {
    /** Whether a list of threads is bound. */
    readonly hasList: boolean
    /** Whether a thread is chosen. */
    readonly hasThread: boolean
    /** Whether the contact pane is bound and shown. */
    readonly hasContact: boolean
}

/** Where the panes stand at one width: the grid areas and the width of each column. */
export interface ConversationArrangement {
    /** The rows of the grid areas, such as `list thread`. */
    readonly areas: ReadonlyArray<string>
    /** The width of each column, left to right. */
    readonly columns: ReadonlyArray<ConversationTrack>
}

/** The arrangement at each width of the grid. */
export interface ConversationLayout {
    /** On a phone. */
    readonly base: ConversationArrangement
    /** From a medium width. */
    readonly medium: ConversationArrangement
    /** From a wide width. */
    readonly wide: ConversationArrangement
}

/** The areas of the panes, left to right, as one row of the grid. */
const rowOf = (names: ReadonlyArray<string>): ConversationArrangement => ({
    areas: [names.join(" ")],
    columns: names.map((name): ConversationTrack => (name === "thread" ? "fill" : "standard")),
})

/**
 * Where the panes stand: on a phone one pane at a time, as wide as the screen (the thread once one is chosen, else the list: a
 * fixed-width list would leave a blank strip beside it), from a medium width the
 * list beside the thread, and from a wide one the contact too.
 */
export const conversationLayoutOf = (panes: ConversationPanes): ConversationLayout => {
    const phone = panes.hasThread || !panes.hasList ? ["thread"] : ["list"]
    const medium = panes.hasList ? ["list", "thread"] : ["thread"]
    return {
        base: { areas: [phone.join(" ")], columns: ["fill"] },
        medium: rowOf(medium),
        wide: rowOf(panes.hasContact ? [...medium, "contact"] : medium),
    }
}
