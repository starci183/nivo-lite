/** The flags of the connect-channel command. */
export interface ProvisionFlags {
    /** The workspace the channel is connected to (its owner is the actor). */
    readonly workspace?: string
    /** The name of the connection. */
    readonly name?: string
    /** Test or live (SePay). */
    readonly environment?: string
    /** The bank code (SePay). */
    readonly bankCode?: string
    /** The account number (SePay). */
    readonly account?: string
    /** The account holder (SePay). */
    readonly holder?: string
    /** Binds the connection to the workspace agents that can use it. */
    readonly bind?: boolean
}
