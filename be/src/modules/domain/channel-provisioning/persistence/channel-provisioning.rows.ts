/** The owner of a workspace. */
export interface OwnerRow {
    /** The account that owns the workspace; provisioning acts in its name. */
    readonly user_id: string
}

/** One agent of a workspace and the module it works for. */
export interface AgentRow {
    /** The agent row id a channel binding points at. */
    readonly id: string
    /** The product module the agent serves, used to pick the agent a new channel is bound to. */
    readonly module: string
}
