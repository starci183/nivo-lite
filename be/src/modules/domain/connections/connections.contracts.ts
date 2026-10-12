/** A connection a delivery arrived on, when it is of the provider and not disconnected. */
export interface IntakeConnection {
    /** The connection id. */
    readonly id: string
    /** The workspace the connection belongs to. */
    readonly workspaceId: string
    /** The connection status: pending, connected or error. */
    readonly status: string
}

/** The first thing a connection received, kept for the wizard's check step. */
export interface FirstEvent {
    /** An amount, for the providers that carry one; zero for a message. */
    readonly amount: number
    /** Who or what the event was about. */
    readonly content: string
    /** When it arrived, ISO 8601. */
    readonly at: string
    /** The first characters of the text, when it had any. */
    readonly text: string
}
