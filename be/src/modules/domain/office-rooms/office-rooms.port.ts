/** One agent as a room lists its seat: who it is, its picture and when it was created (sortable text). */
export interface RoomAgentSeat {
    /** The agent id. */
    readonly id: string
    /** The agent name. */
    readonly name: string
    /** The module (department) the agent works in. */
    readonly module: string
    /** The agent's own picture; null when it has none. */
    readonly avatar_url: string | null
    /** When the agent was created: digits only, fixed width, microsecond exact, so text order is time order. */
    readonly at: string
}

/** The identity of one agent of a workspace. */
export interface RoomAgentRef {
    /** The agent id. */
    readonly id: string
}

/** The one door to the agents of a workspace the rooms read through; the agents capability binds it. */
export interface RoomsAgents {
    /** How many agents the workspace has. */
    countOf(workspaceId: string): Promise<number>
    /** The oldest agents of the workspace as seats, oldest first, bounded. */
    firstSeats(workspaceId: string, limit: number): Promise<Array<RoomAgentSeat>>
    /** The given agents of the workspace as seats (a missing id is missing from the answer). */
    seatsOf(workspaceId: string, agentIds: ReadonlyArray<string>): Promise<Array<RoomAgentSeat>>
    /** The ids of the agents of the workspace in id order, bounded. */
    idsOf(workspaceId: string, limit: number): Promise<Array<string>>
    /** The agent of the workspace with this id; null when the workspace has none. */
    find(workspaceId: string, agentId: string): Promise<RoomAgentRef | null>
}

/** The one door to the customers of a workspace the rooms read through; the leads capability binds it. */
export interface RoomsLeads {
    /** Whether the workspace has a lead with this id. */
    exists(workspaceId: string, leadId: string): Promise<boolean>
}

/** The caller whose own lines never count as unread. */
export interface RoomsReader {
    /** The caller's account id. */
    readonly userId: string
    /** The caller's display name, which recognises legacy lines that carry no account id. */
    readonly displayName: string
}

/** The caller's read marker of one agent's direct conversation (ISO text with microseconds); null while nothing was read. */
export interface RoomsAgentMark {
    /** The agent. */
    readonly agentId: string
    /** The instant the caller read up to. */
    readonly readAt: string | null
}

/** The newest line of an agent's test chats. */
export interface RoomsChatLine {
    /** The line id, the second ordering key. */
    readonly id: string
    /** The text. */
    readonly body: string
    /** The account that wrote it; null for the agent's own lines and unattributed legacy ones. */
    readonly author_user_id: string | null
    /** The name written on the line; null when none was. */
    readonly author_name: string | null
    /** When it was written, ISO 8601 as the database JSON timestamp renders it. */
    readonly at: string
}

/** The unread count and newest line of an agent's test chats. */
export interface RoomsAgentChats {
    /** The agent. */
    readonly agentId: string
    /** Lines the caller has not read across the agent's test chats, at most 99. */
    readonly unread: number
    /** The newest line across them; undefined while nobody wrote. */
    readonly newest: RoomsChatLine | undefined
}

/** The one door to the test chats of the agents the rooms read through; the agent messages capability binds it. */
export interface RoomsTestChats {
    /** For each given agent: the caller's unread lines of its test chats and the newest line of them. */
    activityOf(
        workspaceId: string,
        reader: RoomsReader,
        marks: ReadonlyArray<RoomsAgentMark>,
    ): Promise<Array<RoomsAgentChats>>
}
