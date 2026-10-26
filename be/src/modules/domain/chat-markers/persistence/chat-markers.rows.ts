import type { ChatOwnMessage } from "../chat-markers.contracts"

/** Result of the shared target admission predicate. */
export interface ChatTargetRow {
    /** True only for an active member and existing scoped target. */
    readonly allowed: boolean
}

/** One fetched message cursor resolved from its persisted identity. */
export interface ChatCursorRow {
    /** Persisted message creation instant, never a caller-supplied clock. */
    readonly created_at: string
}

/** The bounded receipt projection, absent when no owned message exists. */
export interface ChatStateRow {
    /** This member's mute preference. */
    readonly muted: boolean
    /** The newest authored message and its other-member receipts. */
    readonly last_own_message: ChatOwnMessage | null
}

/** One account admitted to a target. */
export interface ChatTargetMemberRow {
    /** The admitted account id. */
    readonly user_id: string
}
