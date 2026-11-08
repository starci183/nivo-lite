import { Injectable } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { NodeIndex } from "@nivo-lite/agent-sdk/node"
import { AgentGraphsService, type OptionalGraphState } from "./agent-graphs.service"
import type { GraphChangeKind, GraphDocument } from "./agent-graphs.contracts"
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

/** The change kind of a version a spec published: the rules-derived refresh never replaces it. */
const SPEC: GraphChangeKind = "spec"

/** Whether a graph's live version is a spec holding this flow, whatever the order of the keys of either. */
const heldAsSpec = (state: OptionalGraphState, flow: GraphSpec): boolean =>
    state?.activeKind === SPEC && sameFlow(state.active?.flow, flow)

@Injectable()
/**
 * Puts a flow on the graph of an agent as the version that decides. The flow is judged first against the installed nodes under its own
 * grant, and a flow with a problem is refused with nothing written. The version is of kind `spec`, which the rules-derived refresh
 * never replaces. The same flow live as a spec changes nothing; any other state (another flow, none, or the same one on a version of
 * another kind) publishes the next version, with the nodes and rights of the live one kept, so a rerun restores a flow a version lost.
 */
export class AgentGraphFlowService {
    constructor(private readonly graphs: AgentGraphsService) {}

    /** True when the live version is a spec that already holds this flow, so publishing it would change nothing: one read, nothing written. */
    async holds(workspaceId: string, agentId: string, flow: GraphSpec): Promise<boolean> {
        return heldAsSpec(await this.graphs.stateOfAgent(workspaceId, agentId), flow)
    }

    /** Publishes the flow as the live version of the agent's graph and says what that did. */
    async publish(input: PublishFlowInput): Promise<FlowPublished> {
        const { workspaceId, agentId, installationId, flow, installed } = input
        requireSoundFlow(flow, installed)
        const existing = await this.graphs.stateOfAgent(workspaceId, agentId)
        const state = existing ?? (await this.graphs.ensure(workspaceId, agentId, installationId, EMPTY))
        if (heldAsSpec(state, flow)) return "unchanged"
        await this.graphs.publish({
            workspaceId,
            agentId,
            document: { ...(state.active ?? EMPTY), flow },
            kind: SPEC,
            note: "",
            memberId: null,
            contextVersionId: null,
        })
        return existing === null ? "created" : "replaced"
    }
}
