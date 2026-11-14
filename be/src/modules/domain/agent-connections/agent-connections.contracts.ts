/** How an agent uses a connection (stored on the grant). */
export type Purpose = "inbound_chat" | "outbound_chat" | "bank_feed" | "data_source" | "tool" | "lead_source"

/** One purpose or several. */
export type PurposeSelector = Purpose | ReadonlyArray<Purpose>

/** An active agent bound to a connection. */
export interface BoundAgent {
    /** The agent. */
    readonly id: string
    /** The module the agent belongs to. */
    readonly module: string
    /** The display name. */
    readonly name: string
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
    /** What the agent uses the connection for. */
    readonly purpose: Purpose
}

/** Which bindings of an agent count. */
export interface ConnectionsForOptions {
    /** Only connections whose status is "connected" count. */
    readonly connectedOnly?: boolean
    /** Only connections of these providers count. */
    readonly providers?: ReadonlyArray<string>
}

/** The inbound chat of a connection: its one front door agent. */
export interface InboundRoute {
    /** The agent that answers first, or null when none is bound. */
    readonly front: BoundAgent | null
    /** Always empty: a channel has one front door and no second binding to hand over to (the readers of `front` ignore it). */
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
    /** What the agent uses the connection for. */
    readonly purpose: string
    /** The bot username, or null. */
    readonly bot_username: string | null
    /** The masked bank account, or null. */
    readonly account_masked: string | null
}

/** A stored grant of a connection to an agent. */
export interface StoredGrant {
    /** The agent that holds the grant. */
    readonly agentId: string
    /** The connection the agent may use. */
    readonly connectionId: string
}

/** One grant as the catalog reads it: the agent and the connection it may use, with the purpose of the grant. */
export interface AgentGrant {
    /** The agent that holds the grant. */
    readonly agentId: string
    /** The connection with the purpose of the grant. */
    readonly connection: BoundConnection
}

/** One active agent bound to a connection, with what it uses the connection for (rights live in the agent's attachments). */
export interface ConnectionGrant {
    /** The connection. */
    readonly connectionId: string
    /** The agent. */
    readonly agentId: string
    /** The display name of the agent. */
    readonly agentName: string
    /** The module the agent belongs to. */
    readonly module: string
    /** What the agent uses the connection for. */
    readonly purpose: Purpose
}

/** A binding's connection facts with the agent whose link it came from. */
export interface LinkedFacts {
    /** The agent of the link. */
    readonly agentId: string
    /** The connection facts of the link. */
    readonly facts: BoundConnectionFacts
}

/** One agent that answers a channel connection for its role: a binding of a channel purpose. */
export interface ChannelHolder {
    /** The connection. */
    readonly connectionId: string
    /** The agent. */
    readonly agentId: string
    /** The display name of the agent. */
    readonly agentName: string
    /** The module (role) the agent belongs to. */
    readonly module: string
    /** What the agent uses the connection for. */
    readonly purpose: Purpose
    /** When the grant was written. */
    readonly grantedAt: Date
}

/** The one agent of a role that answers a channel connection, or null when no agent of that role does. */
export type OptionalChannelOwner = ChannelHolder | null

/** A grant about to be written, as the ownership rule weighs it. */
export interface ChannelClaim {
    /** The agent that would hold the grant. */
    readonly agentId: string
    /** The module (role) of the agent. */
    readonly module: string
    /** What the agent would use the connection for. */
    readonly purpose: string
}

/** Whom to keep on a channel two agents of one role would answer once a paused agent resumes: the resumed agent, or the agent that has it now. */
export type ResumeKeep = "resumed" | "current"

/** The choice of whom to keep, or null when the caller has not made one yet. */
export type OptionalResumeKeep = ResumeKeep | null

/** The agent that resumes, as the channel check names it. */
export interface ResumingAgent {
    /** The agent. */
    readonly id: string
    /** Its display name. */
    readonly name: string
    /** Its module (role). */
    readonly module: string
}

/** One channel connection of a resuming agent that another agent of its role answers now. */
export interface ChannelConflict {
    /** The channel connection. */
    readonly connectionId: string
    /** The agent that answers it now. */
    readonly owner: ChannelHolder
}

/** One channel a paused agent answers that another agent of its role answers now. */
export interface ResumeConflict {
    /** The channel connection. */
    readonly connectionId: string
    /** Its display name. */
    readonly connectionName: string
    /** The agent that answers it now. */
    readonly owner: ChannelHolder
}
