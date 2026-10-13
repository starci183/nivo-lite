/** One change of an agent's access to a connection, as the log keeps it. */
export interface AccessChange {
    /** The workspace of both. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** The agent. */
    readonly agentId: string
    /** The connection name at the time of the change. */
    readonly connectionName: string
    /** The agent name at the time of the change. */
    readonly agentName: string
    /** The access before the change, or null when there was none. */
    readonly before: string | null
    /** The access after the change, or null when it was removed. */
    readonly after: string | null
    /** The user who made the change. */
    readonly changedBy: string
    /** That user's display name. */
    readonly changedByName: string
}
