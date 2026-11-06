/** The columns of a room the directory reads: the room, its workspace, whether it is a group, its name and where it sorts. */
export interface DirectoryRoomRow {
    /** The room id. */
    readonly id: string
    /** The workspace the room belongs to. */
    readonly workspaceId: string
    /** `direct` or `group`. */
    readonly kind: string
    /** The name of a group; null for a direct room. */
    readonly name: string | null
    /** Where the room sorts. */
    readonly position: number
}

/** The columns of a seat the directory reads: the room, whether the member is a person or an agent, and who. */
export interface DirectorySeatRow {
    /** The room. */
    readonly roomId: string
    /** `user` or `agent`. */
    readonly memberKind: string
    /** The account id of a user or the agent id. */
    readonly memberId: string
}

/**
 * What the app root tells the directory: the entities of the rooms and of their seats. The team chat owns those tables and sits above the
 * capabilities that read the directory, so the root hands them in and the directory imports nothing from the team chat.
 */
export interface ChatRoomDirectoryOptions {
    /** The entity of the rooms (`public.chat_rooms`). */
    readonly rooms: new () => DirectoryRoomRow
    /** The entity of the seats (`public.chat_room_members`). */
    readonly seats: new () => DirectorySeatRow
}
