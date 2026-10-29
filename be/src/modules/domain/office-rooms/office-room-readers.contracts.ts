/** How a person's room read marker stands against a message instant. */
export type ReaderStanding = "later" | "equal"

/** One person whose room read marker reaches a message instant, and whether it passes it or sits exactly on it. */
export interface RoomReaderStanding {
    /** The reading account. */
    readonly userId: string
    /** The marker is strictly later than the instant, or exactly on it. */
    readonly standing: ReaderStanding
}

/** A room key, '' being the Office room, or null for the Office room asked for without a key. */
export type OptionalRoomKey = string | null
