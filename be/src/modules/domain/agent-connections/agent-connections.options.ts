import type { Type } from "@nestjs/common"
import type { BindingAgentsDirectory } from "./agent-connections.port"

/** The agent-connections configuration: the classes behind the ports of the other lanes. */
export interface AgentConnectionsOptions {
    /** The classes behind the ports of the other lanes. */
    readonly ports: AgentConnectionsPorts
}

/** The classes that implement the ports of the other lanes. */
export interface AgentConnectionsPorts {
    /** Implements the agents port; an existing provider of the app. */
    readonly agents: Type<BindingAgentsDirectory>
}
