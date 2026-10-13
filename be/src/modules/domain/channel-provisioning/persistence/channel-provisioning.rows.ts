/** The owner of a workspace. */
export interface OwnerRow {
    /** The user id of the workspace owner. */
    readonly user_id: string
}

/** One agent of a workspace and the module it works for. */
export interface AgentRow {
    /** The agent id. */
    readonly id: string
    /** The module the agent serves, such as chatbot or accounting. */
    readonly module: string
}
