/** What an agent may do through one connection. */
export type Access = "read" | "ask" | "auto"

/** How an agent uses a connection (stored on the grant). */
export type Purpose = "inbound_chat" | "outbound_chat" | "bank_feed" | "data_source" | "tool" | "lead_source"

/** One purpose or several. */
export type PurposeSelector = Purpose | ReadonlyArray<Purpose>

/** Anything that belongs to a module: an agent, an installation. */
export interface ModuleRef {
    /** The module key. */
    readonly module: string
}

/** An active agent bound to a connection. */
export interface BoundAgent {
    /** The agent. */
    readonly id: string
    /** The module the agent belongs to. */
    readonly module: string
    /** The display name. */
    readonly name: string
    /** What the agent may do through the connection. */
    readonly access: Access
    /** What the agent uses the connection for. */
    readonly purpose: Purpose
}

/** A connection an agent is bound to. */
export interface BoundConnection {
    /** The connection. */
    readonly id: string
    /** The provider (telegram, zalo_oa...). */
    readonly provider: string
    /** The display name. */
    readonly name: string
    /** The bot username, when the provider has one. */
    readonly botUsername: string | null
    /** The masked bank account, when the connection is a bank feed. */
    readonly accountMasked: string | null
    /** connected, error, pending or disconnected. */
    readonly status: string
    /** What the agent may do through the connection. */
    readonly access: Access
    /** What the agent uses the connection for. */
    readonly purpose: Purpose
}

/** Which bindings of a connection count. */
export interface AgentsForOptions {
    /** A binding whose access is "read" does not count: the agent may look, not act or answer. */
    readonly acting?: boolean
    /** Only agents of these modules count. */
    readonly modules?: ReadonlyArray<string>
}

/** Which bindings of an agent count. */
export interface ConnectionsForOptions {
    /** A binding whose access is "read" does not count. */
    readonly acting?: boolean
    /** Only connections whose status is "connected" count. */
    readonly connectedOnly?: boolean
    /** Only connections of these providers count. */
    readonly providers?: ReadonlyArray<string>
}

/** The inbound chat of a connection: the front door agent and the agents it hands over to. */
export interface InboundRoute {
    /** The agent that answers first, or null when none is bound. */
    readonly front: BoundAgent | null
    /** One agent per other module, reached by intent. */
    readonly handovers: ReadonlyArray<BoundAgent>
}

/** One grant of a connection to an agent. */
export interface BindingGrant {
    /** The workspace of both. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The connection. */
    readonly connectionId: string
    /** What the agent uses it for. */
    readonly purpose: Purpose
    /** What the agent may do through it. */
    readonly access: Access
}

/** One binding to remove. */
export interface BindingTarget {
    /** The workspace of both. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The connection. */
    readonly connectionId: string
}

/** A connection id, or null for a conversation that came in on no connection (website chat). */
export type OptionalConnectionId = string | null

/** A binding joined to its active agent, as the binding policy reads it. */
export interface BoundAgentFacts {
    /** The agent. */
    readonly id: string
    /** The module key. */
    readonly module: string
    /** The display name. */
    readonly name: string
    /** When the agent was created, as ISO text. */
    readonly created_at: string
    /** What the agent may do through the connection. */
    readonly access: string
    /** What the agent uses the connection for. */
    readonly purpose: string
}

/** A binding joined to its connection, as the binding policy reads it. */
export interface BoundConnectionFacts {
    /** The connection. */
    readonly id: string
    /** The provider. */
    readonly provider: string
    /** The display name. */
    readonly name: string
    /** The connection status. */
    readonly status: string
    /** When the connection was created, as ISO text. */
    readonly created_at: string
    /** What the agent may do through the connection. */
    readonly access: string
    /** What the agent uses the connection for. */
    readonly purpose: string
    /** The bot username, or null. */
    readonly bot_username: string | null
    /** The masked bank account, or null. */
    readonly account_masked: string | null
}
