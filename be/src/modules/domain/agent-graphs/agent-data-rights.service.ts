import { Injectable } from "@nestjs/common"
import type { DataRightsGate, OptionalDataRights } from "@modules/domain/mcp-gateway"
import { AgentGraphsService } from "./agent-graphs.service"

@Injectable()
/**
 * The data rights of an agent, held in the graph so the owner sees and edits them, for the gateway to enforce on every native read.
 * Default deny holds on every graph, the seed and a graph imported from a template included, in shadow or enforced: an agent reads only
 * what its active version grants (no right is a deny, even with no rights at all). The seed carries the grant of its module's kind
 * of agent, and a template carries none, so its buyer turns each right on. Only an agent with no graph version at all is not governed.
 */
export class AgentDataRightsService implements DataRightsGate {
    constructor(private readonly graphs: AgentGraphsService) {}

    /** The rights of the agent, or null when it has no graph version. */
    async rightsOf(workspaceId: string, agentId: string): Promise<OptionalDataRights> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        return state?.active?.rights ?? null
    }
}
