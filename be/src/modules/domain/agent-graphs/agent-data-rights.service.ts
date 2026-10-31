import { Injectable } from "@nestjs/common"
import type { DataRightsGate, OptionalDataRights } from "@modules/domain/mcp-gateway"
import { AgentGraphsService } from "./agent-graphs.service"

@Injectable()
/**
 * The data rights of an agent, held in the graph so the owner sees and edits them, for the gateway to enforce on every native read.
 * An agent whose graph is enforced reads only what its active version grants (no right is a deny, even with no rights at all);
 * an agent with no graph, or one still in shadow, is not governed yet and its reads pass as they did.
 */
export class AgentDataRightsService implements DataRightsGate {
    constructor(private readonly graphs: AgentGraphsService) {}

    /** The rights of the agent, or null when no enforced graph governs it. */
    async rightsOf(workspaceId: string, agentId: string): Promise<OptionalDataRights> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        return state?.mode === "enforced" ? (state.active?.rights ?? null) : null
    }
}
