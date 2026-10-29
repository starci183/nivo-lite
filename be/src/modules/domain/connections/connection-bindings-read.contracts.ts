/** A connection as the agents bound to it need to see it. */
export interface ConnectionBindingFacts {
    /** The connection. */
    readonly id: string
    /** The provider of the connection. */
    readonly provider: string
    /** The display name. */
    readonly name: string
    /** Where the connection stands. */
    readonly status: string
    /** When the connection was created. */
    readonly createdAt: Date
    /** The bot username the provider reported, trimmed, or null. */
    readonly botUsername: string | null
    /** The masked account the provider reported, trimmed, or null. */
    readonly accountMasked: string | null
}

/** The name and the environment a connection runs in. */
export interface ConnectionState {
    /** The display name. */
    readonly name: string
    /** The environment the connection runs in. */
    readonly environment: string
}

/** The workspace that owns a connection, or null when there is no such connection. */
export type OptionalConnectionWorkspace = string | null

/** The state of a connection, or null when there is no such connection. */
export type OptionalConnectionState = ConnectionState | null
