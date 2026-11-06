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

/** The one door to the agents of a workspace the rooms read through; the agents capability binds it. */
export interface RoomsAgents {
    /** How many agents the workspace has. */
    countOf(workspaceId: string): Promise<number>
    /** The oldest agents of the workspace as seats, oldest first, bounded. */
    firstSeats(workspaceId: string, limit: number): Promise<Array<RoomAgentSeat>>
    /** The given agents of the workspace as seats (a missing id is missing from the answer). */
    seatsOf(workspaceId: string, agentIds: ReadonlyArray<string>): Promise<Array<RoomAgentSeat>>
}
