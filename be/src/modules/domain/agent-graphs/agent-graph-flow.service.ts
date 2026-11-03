import { Injectable } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { NodeIndex } from "@nivo-lite/agent-sdk/node"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphDocument } from "./agent-graphs.contracts"
import { requireSoundFlow, sameFlow } from "./policies/flow.policy"

/** What publishing a flow did: gave the agent its first graph, published another flow as the next version, or found the same flow live. */
export type FlowPublished = "created" | "replaced" | "unchanged"

/** What publishing a flow takes. */
export interface PublishFlowInput {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent that runs the flow. */
    readonly agentId: string
    /** The installation the agent runs as. */
    readonly installationId: string
    /** The flow. */
    readonly flow: GraphSpec
    /** The nodes, effects, tools and data kinds the app installed: the flow is judged against them. */
    readonly installed: NodeIndex
}

const EMPTY: GraphDocument = { nodes: [], rights: [] }

@Injectable()
/**
 * Puts a flow on the graph of an agent as the version that decides. The flow is judged first against the installed nodes under its own
 * grant, and a flow with a problem is refused with nothing written. The same flow again changes nothing; another one is the next
 * version, with the nodes and rights of the live one kept.
 */
export class AgentGraphFlowService {
    constructor(private readonly graphs: AgentGraphsService) {}

    /** Publishes the flow as the live version of the agent's graph and says what that did. */
    async publish(input: PublishFlowInput): Promise<FlowPublished> {
        const { workspaceId, agentId, installationId, flow, installed } = input
        requireSoundFlow(flow, installed)
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        if (state === null) {
            await this.graphs.ensure(workspaceId, agentId, installationId, { ...EMPTY, flow })
            return "created"
        }
        if (sameFlow(state.active?.flow, flow)) return "unchanged"
        await this.graphs.publish({
            workspaceId,
            agentId,
            document: { ...(state.active ?? EMPTY), flow },
            kind: "seed",
            note: "",
            memberId: null,
            contextVersionId: null,
        })
        return "replaced"
    }
}
