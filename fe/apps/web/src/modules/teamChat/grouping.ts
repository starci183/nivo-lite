/** Where a bubble stands in a run of bubbles from one sender (the Messenger corner rule). */
export type GroupPosition = "single" | "first" | "middle" | "last"

/** The longest pause inside a run: a message more than three minutes after the one before opens a new run. */
export const GROUP_GAP_MS: number = 3 * 60 * 1000

/** What the grouping reads of one message. */
export interface GroupItem {
    /** Who sent it (`kind:id`), or null for a message that never joins a run (a card, a system line). */
    readonly sender: string | null
    /** When it was sent (epoch milliseconds). */
    readonly at: number
    /** The message opens a day: the divider before it ends any run. */
    readonly startsDay: boolean
}

/** Whether `current` continues the run that `previous` is in. */
const continues = (previous: GroupItem | undefined, current: GroupItem | undefined): boolean => {
    if (previous === undefined || current === undefined) return false
    if (previous.sender === null || previous.sender !== current.sender || current.startsDay) return false
    const gap = current.at - previous.at
    return gap >= 0 && gap <= GROUP_GAP_MS
}

/**
 * The place of each message in its run, for messages in the order they read. Two neighbours are in one run when they have the same
 * sender, no day divider between them, and at most three minutes between them; a message with no sender stands alone.
 */
export const groupPositionsOf = (items: ReadonlyArray<GroupItem>): ReadonlyArray<GroupPosition> =>
    items.map((item, index) => {
        const joinsBefore = continues(items[index - 1], item)
        const joinsAfter = continues(item, items[index + 1])
        if (joinsBefore) return joinsAfter ? "middle" : "last"
        return joinsAfter ? "first" : "single"
    })
