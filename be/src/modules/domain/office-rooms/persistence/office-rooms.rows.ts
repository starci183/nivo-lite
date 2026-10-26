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

/** The unread count of one agent or customer conversation. */
export interface ConversationUnreadRow {
    /** The agent or lead id. */
    id: string
    /** Lines the caller has not read, at most 99. */
    unread: number
}

/** The newest line and the unread count of a room. */
export interface RoomSummaryRow {
    /** Lines the caller has not read, at most 99. */
    unread: number
    /** Distinct incoming unread bodies containing @, independent of the badge's count cap. */
    unread_mention_bodies: Array<string>
    /** The newest line's text. */
    last_body: string | null
    /** The newest line's author. */
    last_author: string | null
    /** The newest line's author account; null on a legacy line. */
    last_author_user_id: string | null
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

/** One bounded member preview read from the database. */
export interface RoomMemberPreviewRow {
    /** The account id for a person or the agent id. */
    id: string
    /** Whether the preview identifies a workspace account or an agent. */
    kind: "human" | "agent"
    /** The agent's module; null for a person. */
    module: string | null
    /** The member's display name. */
    name: string
    /** The existing provider photo, or null when none exists. */
    avatarUrl: string | null
}

/** One room's grouped member count and first four members. */
export interface RoomMembersRow {
    /** The room key; null is the general Office room. */
    key: string | null
    /** The full member count, including paused agents. */
    count: number
    /** At most four members in deterministic join order. */
    preview: Array<RoomMemberPreviewRow>
}
