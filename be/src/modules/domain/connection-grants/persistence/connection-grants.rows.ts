/** The agent columns a grant check reads. */
export interface AgentRow {
    /** The agent id. */
    readonly id: string
    /** The display name shown in the access log. */
    readonly name: string
    /** The module the agent belongs to, used to decide which providers it may use. */
    readonly module: string
}

/** The columns of a stored grant. */
export interface GrantRow {
    /** The agent the grant is for. */
    readonly agent_id: string
    /** The connection the grant allows. */
    readonly connection_id: string
    /** The access level stored for the pair: ask, read or auto. */
    readonly access: string
}
