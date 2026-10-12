/** The agent columns a grant check reads. */
export interface AgentRow {
    readonly id: string
    readonly name: string
    readonly module: string
}

/** The columns of a stored grant. */
export interface GrantRow {
    readonly agent_id: string
    readonly connection_id: string
    readonly access: string
}
