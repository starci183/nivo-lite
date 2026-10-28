/** The acknowledgement of a typing hint: what the other members are told. */
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
