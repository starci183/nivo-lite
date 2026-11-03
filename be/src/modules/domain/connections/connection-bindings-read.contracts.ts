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

/** A connection as a status read shows it: the binding facts and the code of its last failure. */
export interface ConnectionStatusFacts extends ConnectionBindingFacts {
    /** The code of the last failure, or null when it is healthy. */
    readonly lastError: string | null
    /** The Zalo OA id the provider reported, trimmed, or null. */
    readonly oaId: string | null
    /** The Google account email the grant reported, trimmed, or null. */
    readonly email: string | null
}

/** A bank feed as the workspace's payment account is read from it: where it stands and the account its provider reported. */
export interface FeedAccountFacts {
    /** The connection. */
    readonly id: string
    /** The provider of the feed. */
    readonly provider: string
    /** Where the connection stands. */
    readonly status: string
    /** When the connection was created. */
    readonly createdAt: Date
    /** The full account number the feed stores, trimmed, or null. */
    readonly accountNumber: string | null
    /** The bank code, trimmed, or null. */
    readonly bankCode: string | null
    /** The account holder, trimmed, or null. */
    readonly accountHolder: string | null
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
