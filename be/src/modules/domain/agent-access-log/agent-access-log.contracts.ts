/**
 * The one access an agent holds on a connection: the pair is BOUND (the agent hears and acts on the account's events). Rights are
 * account attachments + each node's one `auto | ask` mode (concept rights): there is no per-pair access level, so a change of access
 * is a binding made (null -> bound) or removed (bound -> null). The table's check constraints allow exactly these values.
 */
export const ACCESS_STATES = ["bound"] as const

/** The access an agent holds on a connection, as the log keeps it. */
export type AccessState = (typeof ACCESS_STATES)[number]

/** A bound pair, as the log keeps it. */
export const BOUND: AccessState = "bound"

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
    readonly before: AccessState | null
    /** The access after the change, or null when it was removed. */
    readonly after: AccessState | null
    /** The user who made the change. */
    readonly changedBy: string
    /** That user's display name. */
    readonly changedByName: string
}
