import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EffectOnce, NodeAgentLoops, NodeModelDoor, NodeToolDoor } from "./graph-nodes.contracts"
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

/**
 * Token of the once-per-key ledger of effects, for a capability outside the graph host that must act once per key (the business
 * ledger writes one line per transaction). The graph-nodes module binds and exports it; an app without the graph host has none.
 */
export const GRAPH_EFFECT_ONCE: unique symbol = Symbol("domain.graph-nodes.effect-once")

/** Injects the once-per-key ledger of effects. Parameter type: EffectOnce. */
export const InjectGraphEffectOnce = (): TypedParameterDecorator<EffectOnce> => injector<EffectOnce>(GRAPH_EFFECT_ONCE)

/** Token of the host's own loop for a step's agent. Absent in an app that binds none: every agent then runs the runner's JSON loop. */
export const GRAPH_NODE_AGENT_LOOPS: unique symbol = Symbol("domain.graph-nodes.agent-loops")

/** Injects the host's own agent loop. Parameter type: NodeAgentLoops. */
export const InjectGraphNodeAgentLoops = (): TypedParameterDecorator<NodeAgentLoops> =>
    injector<NodeAgentLoops>(GRAPH_NODE_AGENT_LOOPS)
