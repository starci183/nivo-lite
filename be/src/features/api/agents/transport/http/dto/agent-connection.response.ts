/** A connection granted to an agent. */
export class AgentConnectionResponse {
    /** The connection. */
    id!: string
    /** The provider (telegram, zalo_oa...). */
    provider!: string
    /** The bot username, when the provider has one. */
    botUsername!: string | null
    /** The masked bank account, when the connection is a bank feed. */
    accountMasked!: string | null
    /** The display name. */
    name!: string
    /** `connected`, `error` or `pending`. */
    status!: string
    /** `read`, `ask` or `auto`. */
    access!: string
    /** What the agent uses the connection for. */
    purpose!: string
}
