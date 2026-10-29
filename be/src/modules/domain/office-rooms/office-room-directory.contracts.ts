/** The name of one department room. */
export interface RoomLabel {
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
