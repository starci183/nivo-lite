/** A signed round-trip state (an OAuth `state`): who started it, where to return, until when, and for what. */
export interface SignedState {
    /** The workspace the round trip belongs to. */
    readonly w: string
    /** The user who started it. */
    readonly u: string
    /** The path to return to, as signed. */
    readonly r: string
    /** The expiry instant, epoch milliseconds. */
    readonly e: number
    /** The purpose of the round trip, when the signer names one. */
    readonly p?: string
}

/** Text that may be absent: a return path or a state value as a request carries it. */
export type OptionalStateText = string | null | undefined

/** A derived state-signing key, or null when the channel key is not 32 bytes. */
export type OptionalStateKey = Buffer | null

/** A verified state, or null when the value is not a valid, current one. */
export type OptionalSignedState = SignedState | null
