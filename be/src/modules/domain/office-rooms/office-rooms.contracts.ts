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
    /** The account id for a person or the agent id. */
    readonly id: string
    /** Whether the preview identifies a workspace account or an agent. */
    readonly kind: "human" | "agent"
    /** The agent's module; null for a person. */
    readonly module: string | null
    /** The member's display name in this workspace. */
    readonly name: string
    /** The person's HTTPS profile photo or the agent's own picture; null for the generated avatar. */
    readonly avatarUrl: string | null
}

/** A group room's full member count and bounded avatar preview. */
export interface RoomMembersView {
    /**
     * The room header must read this members.count: active seated accounts plus all seated agents, including paused agents.
     * Departments without active person seats include active workspace owners and managers instead. The general Office
     * room includes all active workspace accounts and all agents; staff without an account cannot enter chat and do not count.
     */
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
    /** Distinct incoming unread bodies containing @, for matching the caller's handle or display name. */
    readonly unread_mention_bodies: ReadonlyArray<string>
    /** The newest line's text. */
    readonly last_body: string | null
    /** The newest line's author. */
    readonly last_author: string | null
    /** The newest line's author account; null on a legacy line. */
    readonly last_author_user_id: string | null
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
    readonly members: RoomMembersView
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
