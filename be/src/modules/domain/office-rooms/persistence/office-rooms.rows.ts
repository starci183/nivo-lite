/** How many department rooms one setup opened. */
export interface OpenedRow {
    /** Rooms created by this call; 0 when they all existed. */
    opened: number
}

/** One pinned document of a room. */
export interface PinRow {
    /** The pin id. */
    id: string
    /** The document title. */
    title: string
    /** Where it opens, when it does. */
    href: string | null
    /** The line under it. */
    note: string
}

/** The newest line and the unread count of a room. */
export interface RoomSummaryRow {
    /** Lines the caller has not read, at most 99. */
    unread: number
    /** The newest line's text. */
    last_body: string | null
    /** The newest line's author. */
    last_author: string | null
    /** When the newest line was written, ISO 8601. */
    last_at: string | null
}

/** One department room with its summary, members and pins. */
export interface RoomRow extends RoomSummaryRow {
    /** The room key. */
    key: string
    /** The display name. */
    name: string
    /** The order in the list. */
    position: number
    /** The agents seated in the room. */
    agent_ids: Array<string>
    /** The agents whose lines land here. */
    home_agent_ids: Array<string>
    /** The people seated in the room. */
    user_ids: Array<string>
    /** The pinned documents. */
    pins: Array<PinRow>
}
