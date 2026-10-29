/** What the room directory needs from the composition root: nothing but whether it is global. */
export interface OfficeRoomDirectoryOptions {
    /** Registers the capability for every module of the app. */
    readonly isGlobal?: boolean
}
