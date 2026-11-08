import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { NodeModelDoor, NodeToolDoor } from "./graph-nodes.contracts"
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

/** Token of the model door: the app root binds the agents' prompt library, so the host never imports it. */
export const GRAPH_NODE_MODEL: unique symbol = Symbol("domain.graph-nodes.model")

/** Injects the model door. Parameter type: NodeModelDoor. */
export const InjectGraphNodeModel = (): TypedParameterDecorator<NodeModelDoor> =>
    injector<NodeModelDoor>(GRAPH_NODE_MODEL)
