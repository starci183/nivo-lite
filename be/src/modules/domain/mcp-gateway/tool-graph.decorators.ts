import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { ToolGraphGate } from "./mcp-gateway.contracts"

/** Token of the graph's gate on write tools: absent until the action graph binds one, and then the grant alone decides. */
export const TOOL_GRAPH_GATE: unique symbol = Symbol("domain.mcp-gateway.tool-graph-gate")

/** Injects the graph's gate on write tools. Parameter type: ToolGraphGate. */
export const InjectToolGraphGate = (): TypedParameterDecorator<ToolGraphGate> =>
    injector<ToolGraphGate>(TOOL_GRAPH_GATE)
