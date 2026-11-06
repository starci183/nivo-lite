/** The name of one team-chat group. */
export interface ChatRoomName {
    /** The room id: what an approver group and an agent's assignable rooms hold. */
    readonly key: string
    /** The display name. */
    readonly name: string
}

/** One team-chat group an account sits in. */
export interface ChatSeatRoom {
    /** The account id. */
    readonly userId: string
    /** The room id. */
    readonly key: string
}

/** The one door to the team-chat groups other capabilities read through; the root binds it. */
export interface ChatRoomDirectory {
    /** The names of the groups of a workspace by room id, in room order, at most `limit`. */
    labelsOf(workspaceId: string, roomIds: ReadonlyArray<string>, limit: number): Promise<Array<ChatRoomName>>
    /** The groups the given accounts sit in, in room order, at most `limit` seats (a room of another workspace never counts). */
    seatRoomsOf(workspaceId: string, userIds: ReadonlyArray<string>, limit: number): Promise<Array<ChatSeatRoom>>
}
