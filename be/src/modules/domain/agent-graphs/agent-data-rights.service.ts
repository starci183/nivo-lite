import { Injectable } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { dataKindOfTool } from "@modules/domain/mcp-gateway"
import type { DataRight, DataRightsGate, OptionalDataRights } from "@modules/domain/mcp-gateway"
import { AgentGraphsService } from "./agent-graphs.service"

/**
 * The rights of a graph with the ones its flow implies: a flow whose grant declares a NIVO MCP tool that reads a kind of data
 * (`nivo.brain.search` reads the Brain) holds the right on that kind, the narrowest one (the conversation the call serves, nothing hidden or
 * masked: what a seed gives), unless the graph already states a right on the kind, which then decides. Without it a flow that declares
 * a read could never run it: a published spec carries no right of its own. A kind no declared tool reads stays a deny.
 */
export const rightsWithFlow = (rights: ReadonlyArray<DataRight>, flow: GraphSpec | undefined): ReadonlyArray<DataRight> => {
    const held = new Set(rights.map((right) => right.kind))
    const implied = (flow?.grant.tools ?? []).flatMap((tool) => {
        const kind = dataKindOfTool(tool)
        return kind === null || held.has(kind) ? [] : [kind]
    })
    return [
        ...rights,
        ...[...new Set(implied)].map((kind): DataRight => ({ kind, scope: "conversation", hide: [], mask: [] })),
    ]
}

@Injectable()
/**
 * The data rights of an agent, held in the graph so the owner sees and edits them, for the gateway to enforce on every native read.
 * Default deny holds on every graph, the seed and a graph imported from a template included, in shadow or enforced: an agent reads only
 * what its active version grants (no right is a deny, even with no rights at all): the rights it states, and for a version that holds
 * a flow the kinds the tools of the flow's grant read (`rightsWithFlow`). The seed carries the grant of its module's kind of agent, and
 * a template carries none, so its buyer turns each right on. Only an agent with no graph version at all is not governed.
 */
export class AgentDataRightsService implements DataRightsGate {
    constructor(private readonly graphs: AgentGraphsService) {}

    /** The rights of the agent, or null when it has no graph version. */
    async rightsOf(workspaceId: string, agentId: string): Promise<OptionalDataRights> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        const active = state?.active
        if (active === null || active === undefined) return null
        return rightsWithFlow(active.rights, active.flow)
    }
}
