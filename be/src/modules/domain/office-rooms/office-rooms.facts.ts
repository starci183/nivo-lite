import type { RoomPinView } from "./office-rooms.contracts"

/** The newest line and the unread count of a room, as the summary read answers them. */
export interface RoomSummaryFacts {
    /** Lines the caller has not read, at most 99. */
    readonly unread: number
    /** Distinct incoming unread bodies containing @, independent of the badge's count cap. */
    readonly unread_mention_bodies: Array<string>
    /** The newest line's text. */
    readonly last_body: string | null
    /** The newest line's author. */
    readonly last_author: string | null
    /** The newest line's author account; null on a legacy line. */
    readonly last_author_user_id: string | null
    /** When the newest line was written, in the text shape of the database JSON timestamp (ISO 8601). */
    readonly last_at: string | null
}

/** One department room with its summary, seats and pins, as the list read answers it. */
export interface RoomFacts extends RoomSummaryFacts {
    /** The room key. */
    readonly key: string
    /** The display name. */
    readonly name: string
    /** The order in the list. */
    readonly position: number
    /** The agents seated in the room. */
    readonly agent_ids: Array<string>
    /** The agents whose lines land here. */
    readonly home_agent_ids: Array<string>
    /** The people seated in the room. */
    readonly user_ids: Array<string>
    /** The pinned documents. */
    readonly pins: Array<RoomPinView>
}

/** The unread count of one agent or customer conversation. */
export interface ConversationUnreadFacts {
    /** The agent or lead id. */
    readonly id: string
    /** Lines the caller has not read, at most 99. */
    readonly unread: number
}

/** One agent's direct conversation: its unread count and its newest line. */
export interface AgentConversationFacts extends ConversationUnreadFacts {
    /** The newest line's text; null while nobody wrote. */
    readonly last_body: string | null
    /** The workspace account id of the newest line's author; null for the agent's own lines and unattributed legacy ones. */
    readonly last_author_id: string | null
    /** The display name of the newest line's human author; null for the agent's own and system lines. */
    readonly last_author: string | null
    /** When the newest line was written, in the text shape of the database JSON timestamp (ISO 8601); null while nobody wrote. */
    readonly last_at: string | null
}

/** How many department rooms one setup opened. */
export interface OpenedFacts {
    /** Rooms created by this call; 0 when they all existed. */
    readonly opened: number
}
