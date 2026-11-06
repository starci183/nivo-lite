/** One department room, or the aggregate Office (null). */
export interface ChatTarget {
    /** A department key; null is the aggregate Office. */
    readonly room: string | null
}

/** One other active workspace account that has seen the last authored message. */
export interface ChatSeenMember {
    /** The account id. */
    readonly id: string
    /** The current workspace display name. */
    readonly name: string
    /** Stable initials-avatar seed: the account id. */
    readonly avatarSeed: string
    /** The uploaded profile picture, else the provider picture; null draws the generated avatar. */
    readonly avatarUrl: string | null
}

/** The persisted state beneath the caller's newest authored message in this target. */
export interface ChatOwnMessage {
    /** The message whose state is shown, even when others have posted newer messages. */
    readonly id: string
    /** Seen overrides delivered; sent means no other active member has acknowledged it. */
    readonly status: "sent" | "delivered" | "seen"
    /** At most three readers, ordered by account id. */
    readonly seenBy: Array<ChatSeenMember>
    /** All other active readers, including those beyond the bounded avatar list. */
    readonly seenByCount: number
}

/** The caller's room preference and last authored message receipt. */
export interface ChatMarkerState {
    /** True selects the muted dot presentation in the frontend. */
    readonly muted: boolean
    /** Null before this account has authored a message with a stable account id. */
    readonly lastOwnMessage: ChatOwnMessage | null
}
