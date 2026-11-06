import { Injectable } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { DataRight, DataRightsGate, OptionalDataRights } from "@modules/domain/mcp-gateway"
import { AgentGraphsService } from "./agent-graphs.service"

/** The data kind a right of a flow's grant gives the agent's tools to read; a right of another kind reaches no stored data a tool reads. */
const KIND_OF_FLOW_RIGHT: Readonly<Record<string, DataRight["kind"]>> = { "payment-account": "payments" }

/**
 * What the flow an agent runs reads through its tools, as data rights: the node that asks `payment.instruction` is granted the
 * `payment-account` read, and the gateway judges that tool as a read of payments. Without it a governed agent whose flow is its
 * graph (no hand-drawn rights) would be refused every tool its own grant names. Narrowed to the conversation, as an agent that faces
 * customers always is; a kind the graph already holds is not repeated.
 */
const flowRightsOf = (flow: GraphSpec | undefined, held: ReadonlyArray<DataRight>): ReadonlyArray<DataRight> => {
    const kinds = new Set(held.map((right) => right.kind))
    const given = (flow?.grant.rights ?? [])
        .filter((right) => right.access === "read")
        .flatMap((right) => {
            const kind = KIND_OF_FLOW_RIGHT[right.kind]
            return kind === undefined || kinds.has(kind) ? [] : [kind]
        })
    return [...new Set(given)].map((kind) => ({ kind, scope: "conversation" as const, hide: [], mask: [] }))
}

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
        const active = state?.active
        if (active === null || active === undefined) return null
        return [...active.rights, ...flowRightsOf(active.flow, active.rights)]
    }
}
