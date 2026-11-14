import type { GraphV2Step, Mode, ModelId, NodeId } from "../graph/graph-spec-v2.types"
import type { ProviderKey } from "../names"
import type { JsonObject } from "../schema/schema.types"

/** The wiring of a running node: the step of its graph as stored (`nivo/agent-graph@2`). */
export type GraphStepWiring = GraphV2Step

/** One bound account of a running node: the provider and the workspace's connection of it. */
export interface RunningNodeAccount {
    /** The provider the account belongs to. */
    readonly provider: ProviderKey
    /** The id of the connection the account uses. */
    readonly connectionId: string
}

/** The template node and the pinned version whose `run` a running node executes. */
export interface RunningNodeTemplate {
    /** The template node. */
    readonly nodeId: NodeId
    /** The pinned version of it. */
    readonly version: number
}

/**
 * A node as the ENGINE runs it (contract C2): a template node bound to one workspace's agent, workflow and accounts. The DB holds data
 * only; `run` ALWAYS comes from the pinned template version. Exported for the host's signature; never built by a package.
 */
export interface RunningNode {
    /** The workspace the node runs in. */
    readonly workspaceId: string
    /** The agent the node runs under. */
    readonly agentId: string
    /** The workflow the node belongs to. */
    readonly workflowId: string
    /** The key of the node's step in the graph. */
    readonly nodeKey: string
    /** The template node and version whose `run` this node executes. */
    readonly template: RunningNodeTemplate
    /** How its calls run: the step's mode (the workflow's, else the node's); `ask` interrupts for a person's approval (`nivo-frame.rights`). */
    readonly mode: Mode
    /** Bound, in the step's provider order (alternatives); an unconnected provider is ABSENT. */
    readonly accounts: ReadonlyArray<RunningNodeAccount>
    /** The model the node's AI call uses. */
    readonly model: ModelId
    /** The step's parameters, resolved for this run. */
    readonly params: JsonObject
    /** How the step is wired to its neighbours. */
    readonly wiring: GraphStepWiring
}
