/** A connection granted to an agent. */
export class AgentConnectionResponse {
    /** The connection. */
    id!: string
    /** The provider (telegram, zalo_oa...). */
    provider!: string
    /** The display name. */
    name!: string
    /** `connected`, `error` or `pending`. */
    status!: string
    /** `read`, `ask` or `auto`. */
    access!: string
    /** What the agent uses the connection for. */
    purpose!: string
}
