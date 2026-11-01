import { Injectable } from "@nestjs/common"
import type { DataRightsGate, OptionalDataRights } from "@modules/domain/mcp-gateway"
import { AgentGraphsService } from "./agent-graphs.service"

@Injectable()
/**
 * The data rights of an agent, held in the graph so the owner sees and edits them, for the gateway to enforce on every native read.
 * An agent whose enforced graph a person published reads only what its active version grants (no right is a deny, even with no
 * rights at all). A seed holds no rights because no person has chosen any yet, not because the agent may read nothing, so an agent on
 * its seed, with no graph, or set to shadow is not governed yet and its reads pass as they did.
 */
export class AgentDataRightsService implements DataRightsGate {
    constructor(private readonly graphs: AgentGraphsService) {}

    /** The rights of the agent, or null when no graph a person published governs it. */
    async rightsOf(workspaceId: string, agentId: string): Promise<OptionalDataRights> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        return state?.mode === "enforced" && state.activeKind !== "seed" ? (state.active?.rights ?? null) : null
    }
}
