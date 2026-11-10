import type { InjectionToken, Type } from "@nestjs/common"
import type { NodeInstall, NodeToolDoor } from "./graph-nodes.contracts"

/** What the app root decides for the graph-nodes capability. */
export interface GraphNodesOptions {
    /** The installed nodes, effects, tools and data kinds the app assembled from its node packages. */
    readonly install: NodeInstall
    /** Provider of the `NodeModelDoor` port: the agents' prompt library. */
    readonly model: InjectionToken
    /** The class of the `NodeToolDoor` port: the NIVO MCP gateway's door, which the app root names so the host never imports it. */
    readonly tools: Type<NodeToolDoor>
    /**
     * The host's own loop for a step's agent (native tool calling), and the nodes it takes the turns of (`AGENT_LOOP`). Absent, or
     * with no node named, every step's agent runs the runner's JSON loop. `loops` is the provider of the `NodeAgentLoops` port.
     */
    readonly agentLoop?: { readonly nodes: ReadonlyArray<string>; readonly loops?: InjectionToken | undefined } | undefined
}
