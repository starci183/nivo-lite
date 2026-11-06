import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { AgentConnections, AgentDone, AgentKnowledge } from "./platform.types"

/** What the agents finished (the agent's work log of the workspace). */
export const agentDonePort: PortDefinition<AgentDone> = definePort<AgentDone>("platform.agent-done")

/** The connections of the workspace bound to an agent. */
export const agentConnectionsPort: PortDefinition<AgentConnections> =
    definePort<AgentConnections>("platform.agent-connections")

/** The knowledge an agent reads and its open gaps. */
export const agentKnowledgePort: PortDefinition<AgentKnowledge> = definePort<AgentKnowledge>("platform.agent-knowledge")
