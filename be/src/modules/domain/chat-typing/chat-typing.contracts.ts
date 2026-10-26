/** The private Supabase broadcast channel of one authorized chat target. */
export interface ChatTypingChannel {
    /** Pass this exact topic to Supabase's channel method with private enabled. */
    readonly topic: string
    /** Subscribe to this broadcast event. */
    readonly event: string
    /** The channel must be joined with config.private = true. */
    readonly private: boolean
    /** A typing signal expires after this many milliseconds; refresh before that deadline while typing. */
    readonly ttlMs: number
}

/** The server-authored JSON payload of a typing broadcast. */
export interface ChatTypingSignal {
    /** The workspace account that is typing. */
    readonly id: string
    /** Their current workspace display name. */
    readonly name: string
    /** Stable initials-avatar seed, equal to the account id. */
    readonly avatarSeed: string
    /** False immediately clears the indicator; true is bounded by expiresAt. */
    readonly typing: boolean
    /** ISO 8601 deadline; receivers discard expired signals, including after a disconnect. */
    readonly expiresAt: string
}

/** One typing frame on the realtime hub: `id` is `${actorId}:${at}`, the `Last-Event-ID` resume point. */
export interface ChatTypingFrame {
    /** The domain event id of the frame. */
    readonly id: string
    /** The workspace account that is typing. */
    readonly actorId: string
    /** Their display name. */
    readonly actorName: string
    /** Start refreshes the indicator, stop clears it. */
    readonly state: "start" | "stop"
    /** ISO 8601 time of the signal. */
    readonly at: string
}
