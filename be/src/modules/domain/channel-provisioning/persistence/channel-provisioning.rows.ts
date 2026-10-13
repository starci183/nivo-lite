/** The owner of a workspace. */
export interface OwnerRow {
    readonly user_id: string
}

/** One agent of a workspace and the module it works for. */
export interface AgentRow {
    readonly id: string
    readonly module: string
}
