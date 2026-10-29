/** One agent as the readers of other capabilities see it: who it is, the department it works in and the agents it may tag. */
export interface AgentCard {
    /** The agent id. */
    readonly id: string
    /** The agent name. */
    readonly name: string
    /** The module (department) the agent works in. */
    readonly module: string
    /** The agents it may tag, in the owner's order. */
    readonly canTagAgentIds: ReadonlyArray<string>
}

/** One agent as a room or an office lists its seat: who it is, its picture and when it was created (sortable text). */
export interface AgentSeat {
    /** The agent id. */
    readonly id: string
    /** The agent name. */
    readonly name: string
    /** The module (department) the agent works in. */
    readonly module: string
    /** The agent's own picture; null when it has none. */
    readonly avatar_url: string | null
    /** When the agent was created: digits only, fixed width, microsecond exact, so text order is time order. */
    readonly at: string
}

/** An active agent as the mention reader sees it: the handle people tag it with. */
export interface AgentHandleCard {
    /** The agent id. */
    readonly id: string
    /** The handle. */
    readonly handle: string
    /** The module (department) the agent works in. */
    readonly module: string
    /** The agent name. */
    readonly name: string
}

/** An agent as an installation shows it: its name, the handle people tag it with and its own picture. */
export interface AgentIdentityCard {
    /** The agent id. */
    readonly id: string
    /** The agent name. */
    readonly name: string
    /** The handle. */
    readonly handle: string
    /** The agent's own picture; null when it has none. */
    readonly avatarUrl: string | null
}

/** One agent with its whole sheet, as the dashboards of the workspace list it. */
export interface AgentSheet {
    /** The agent id. */
    readonly id: string
    /** The module (department) the agent works in. */
    readonly module: string
    /** The agent name. */
    readonly name: string
    /** The handle people tag it with. */
    readonly handle: string
    /** The role line. */
    readonly role: string
    /** The instructions. */
    readonly instructions: string
    /** The knowledge text. */
    readonly knowledge: string
    /** The greeting. */
    readonly greeting: string
    /** The approval rule. */
    readonly approvalRule: string
    /** Active or paused. */
    readonly status: string
    /** When the agent was created. */
    readonly createdAt: Date
}

/** An agent card, or null when there is none. */
export type OptionalAgentCard = AgentCard | null

/** An agent sheet, or null when there is none. */
export type OptionalAgentSheet = AgentSheet | null
