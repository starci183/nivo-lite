/** One pinned document of a Hub room. */
export interface RoomPinView {
    /** The pin id. */
    readonly id: string
    /** The document title. */
    readonly title: string
    /** Where it opens, when it does. */
    readonly href: string | null
    /** The line under it. */
    readonly note: string
}

/** One of the first four active people or seated agents of a group room. */
export interface RoomMemberPreviewView {
    /** The member's display name in this workspace. */
    readonly name: string
    /** The existing provider profile URL; null for members without a photo, including agents. */
    readonly avatarUrl: string | null
}

/** A group room's full member count and bounded avatar preview. */
export interface RoomMembersView {
    /** The number of active people and seated agents, including paused agents. */
    readonly count: number
    /** At most four members, ordered by when they joined, then their seat id. */
    readonly preview: ReadonlyArray<RoomMemberPreviewView>
}

/** One Hub room as the room list and the room panel read it. */
export interface RoomView {
    /** The room key; null is the general Office room. */
    readonly key: string | null
    /** The display name; empty for the Office room (the screen names it). */
    readonly name: string
    /** The order in the list; the Office room is 0. */
    readonly position: number
    /** Lines the caller has not read, at most 99. */
    readonly unread: number
    /** The newest line's text. */
    readonly last_body: string | null
    /** The newest line's author. */
    readonly last_author: string | null
    /** When the newest line was written, ISO 8601. */
    readonly last_at: string | null
    /** The agents seated in the room; empty for the Office room (everyone). */
    readonly agent_ids: ReadonlyArray<string>
    /** The agents whose lines land in the room. */
    readonly home_agent_ids: ReadonlyArray<string>
    /** The people seated in the room; empty for the Office room (everyone). */
    readonly user_ids: ReadonlyArray<string>
    /** The pinned documents. */
    readonly pins: ReadonlyArray<RoomPinView>
    /** The group members available to the room list. */
    readonly members?: RoomMembersView | null
}

/** A room key as a caller names it; null is the general Office room. Checked against the Hub rooms before use. */
export type RoomChoice = string | null

/** Which direct conversation a caller names: one agent's lines, or one customer's (lead's) lines. */
export type ConversationKind = "agent" | "lead"

/** The unread count of one direct conversation. */
export interface ConversationUnreadView {
    /** The agent or lead id. */
    readonly id: string
    /** Lines the caller has not read, at most 99. */
    readonly unread: number
}

/** The caller's unread counts of the direct conversations; only conversations above zero are listed. */
export interface ConversationUnreadListView {
    /** The unread agent conversations. */
    readonly agents: ReadonlyArray<ConversationUnreadView>
    /** The unread customer conversations. */
    readonly leads: ReadonlyArray<ConversationUnreadView>
}
