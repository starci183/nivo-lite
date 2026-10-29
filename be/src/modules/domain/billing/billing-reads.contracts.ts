/** The facts of a connection the bank feed reads before it records a credit. */
export interface ConnectionStateRead {
    /** The connection name. */
    readonly name: string
    /** The environment the connection runs in. */
    readonly environment: string
}
