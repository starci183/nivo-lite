/** The name of one department room. */
export interface RoomName {
    /** The room key. */
    readonly key: string
    /** The display name. */
    readonly name: string
}

/** One department room an account sits in. */
export interface UserSeatRoom {
    /** The account id. */
    readonly userId: string
    /** The room key. */
    readonly key: string
}

/** The department rooms a lookup narrows to, by key; null asks for every room. */
export type OptionalRoomKeys = ReadonlyArray<string> | null
