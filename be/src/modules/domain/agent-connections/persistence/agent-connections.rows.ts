/** A binding joined to its active agent. */
export interface BoundAgentRow {
    /** The agent. */
    id: string
    /** The module key. */
    module: string
    /** The display name. */
    name: string
    /** When the agent was created. */
    created_at: string
    /** What the agent may do through the connection. */
    access: string
    /** What the agent uses the connection for. */
    purpose: string
}

/** A binding joined to its connection. */
export interface BoundConnectionRow {
    /** The connection. */
    id: string
    /** The provider. */
    provider: string
    /** The display name. */
    name: string
    /** The connection status. */
    status: string
    /** When the connection was created. */
    created_at: string
    /** What the agent may do through the connection. */
    access: string
    /** What the agent uses the connection for. */
    purpose: string
}

/** The key a binding upsert answers. */
export interface BindingKeyRow {
    /** The agent of the binding. */
    agent_id: string
}
