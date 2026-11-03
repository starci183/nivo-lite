import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { NodeToolDoor } from "./graph-nodes.contracts"
import type { GraphNodesOptions } from "./graph-nodes.options"

/** Token of the graph-nodes options: the install the app assembled. */
export const GRAPH_NODES_OPTIONS: unique symbol = Symbol("domain.graph-nodes.options")

/** Injects the graph-nodes options. Parameter type: GraphNodesOptions. */
export const InjectGraphNodesOptions = (): TypedParameterDecorator<GraphNodesOptions> =>
    injector<GraphNodesOptions>(GRAPH_NODES_OPTIONS)

/** Token of the NIVO MCP door node tools go through. Absent until the MCP capability binds it; a tool call then fails visibly. */
export const GRAPH_NODE_TOOL_DOOR: unique symbol = Symbol("domain.graph-nodes.tool-door")

/** Injects the node tool door. Parameter type: NodeToolDoor. */
export const InjectGraphNodeToolDoor = (): TypedParameterDecorator<NodeToolDoor> =>
    injector<NodeToolDoor>(GRAPH_NODE_TOOL_DOOR)
