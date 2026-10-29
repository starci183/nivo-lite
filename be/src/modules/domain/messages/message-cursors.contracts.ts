/** One message as a receipt measures it: its id and its creation instant in the database's own text. */
export interface RoomMessageCursor {
    /** The message id. */
    readonly id: string
    /** The creation instant, in the database's own text, so no precision is lost. */
    readonly createdAt: string
}

/** A message position, or null when there is none. */
export type OptionalRoomMessageCursor = RoomMessageCursor | null

/** An office room key, or null for any office room. */
export type OptionalReceiptRoom = string | null

/** A creation instant in the database's own text, or null when there is none. */
export type OptionalReceiptInstant = string | null
