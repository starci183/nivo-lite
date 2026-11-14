import { AgentGraphProposalEntity } from "./agent-graph-proposal.entity"
import { AgentGraphSourceEntity } from "./agent-graph-source.entity"
import { AgentGraphVersionEntity } from "./agent-graph-version.entity"
import { AgentGraphEntity } from "./agent-graph.entity"
import { AgentWorkflowVersionEntity } from "./agent-workflow-version.entity"
import { AgentWorkflowEntity } from "./agent-workflow.entity"
import { WorkflowTriggerPickEntity } from "./workflow-trigger-pick.entity"

export {
    AgentGraphEntity,
    AgentGraphProposalEntity,
    AgentGraphSourceEntity,
    AgentGraphVersionEntity,
    AgentWorkflowEntity,
    AgentWorkflowVersionEntity,
    WorkflowTriggerPickEntity,
}

/** Every entity the agent-graphs capability owns, collected by the database connection. */
export const agentGraphsEntities: readonly [
    typeof WorkflowTriggerPickEntity,
    typeof AgentGraphEntity,
    typeof AgentGraphVersionEntity,
    typeof AgentGraphSourceEntity,
    typeof AgentGraphProposalEntity,
    typeof AgentWorkflowEntity,
    typeof AgentWorkflowVersionEntity,
] = [
    WorkflowTriggerPickEntity,
    AgentGraphEntity,
    AgentGraphVersionEntity,
    AgentGraphSourceEntity,
    AgentGraphProposalEntity,
    AgentWorkflowEntity,
    AgentWorkflowVersionEntity,
] as const
