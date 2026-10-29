/** One connection joined with its secret row. */
export interface ConnectionSecretRead {
    /** The workspace the connection belongs to. */
    readonly workspace_id: string
    /** The connection status. */
    readonly status: string
    /** The provider of the connection. */
    readonly provider: string
    /** The encrypted credential. */
    readonly ciphertext: string
    /** The per-connection webhook secret. */
    readonly webhook_secret: string
}

/** The facts of a connection the bank feed reads before it records a credit. */
export interface ConnectionStateRead {
    /** The connection name. */
    readonly name: string
    /** The environment the connection runs in. */
    readonly environment: string
}
