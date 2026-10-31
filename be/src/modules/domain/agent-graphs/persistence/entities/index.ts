import { AgentGraphDecisionEntity } from "./agent-graph-decision.entity"
import { AgentGraphEntity } from "./agent-graph.entity"
import { AgentGraphProposalEntity } from "./agent-graph-proposal.entity"
import { AgentGraphSourceEntity } from "./agent-graph-source.entity"
import { AgentGraphVersionEntity } from "./agent-graph-version.entity"

export { AgentGraphDecisionEntity } from "./agent-graph-decision.entity"
export { AgentGraphEntity } from "./agent-graph.entity"
export { AgentGraphProposalEntity } from "./agent-graph-proposal.entity"
export { AgentGraphSourceEntity } from "./agent-graph-source.entity"
export { AgentGraphVersionEntity } from "./agent-graph-version.entity"

/** Every entity of the agent-graphs capability. */
export const agentGraphsEntities = [
    AgentGraphEntity,
    AgentGraphVersionEntity,
    AgentGraphSourceEntity,
    AgentGraphProposalEntity,
    AgentGraphDecisionEntity,
] as const
