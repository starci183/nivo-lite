/** The agent columns a grant check reads. */
export interface AgentRow {
    /** The agent row id a grant is keyed by. */
    readonly id: string
    /** The display name shown next to the grant in the console. */
    readonly name: string
    /** The product module the agent serves, which bounds the connections it may be granted. */
    readonly module: string
}

/** The columns of a stored grant. */
export interface GrantRow {
    /** The agent that holds the grant. */
    readonly agent_id: string
    /** The connection the agent is allowed to use. */
    readonly connection_id: string
    /** The stored access level, parsed into an Access before use. */
    readonly access: string
}
