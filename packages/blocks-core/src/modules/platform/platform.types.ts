import type { ConnectionsRegionView, ItemsRegionView, KnowledgeRegionView } from "../../views/views.types"

/** What the agent finished in the last days, as the region lists it. */
export interface DoneSummary {
    /** How many things the agent finished in all. */
    readonly total: number
    /** The newest ones, at most the limit asked. */
    readonly rows: ItemsRegionView["rows"]
}

/** The data the agent page asks of the platform about one agent. */
export interface AgentDone {
    /** What the agent finished lately: the count and the newest items. */
    readonly recent: (agentId: string, limit: number) => Promise<DoneSummary>
}

/** The connections bound to one agent. */
export interface AgentConnections {
    /** The connections region of the agent, with the words of the viewer's workspace. */
    readonly of: (agentId: string) => Promise<ConnectionsRegionView>
}

/** What one agent knows. */
export interface AgentKnowledge {
    /** The knowledge region of the agent, with its open gaps. */
    readonly of: (agentId: string) => Promise<KnowledgeRegionView>
}
