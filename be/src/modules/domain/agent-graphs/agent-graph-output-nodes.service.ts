import { Injectable } from "@nestjs/common"
import type { OutputNodeReader, OutputNodes } from "@modules/domain/authority-rules"
import { AgentGraphsService } from "./agent-graphs.service"
import { NO_OUTPUT_NODES, outputNodesOf } from "./policies/output-nodes.policy"

@Injectable()
/** The nodes the steps of an output run on, read from the active version, so a run's trace names what the published graph drew. */
export class AgentGraphOutputNodesService implements OutputNodeReader {
    constructor(private readonly graphs: AgentGraphsService) {}

    /** The nodes of the agent's active version; none for an agent with no graph. */
    async nodesOf(workspaceId: string, agentId: string): Promise<OutputNodes> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        return state?.active === null || state === null ? NO_OUTPUT_NODES : outputNodesOf(state.active)
    }
}
