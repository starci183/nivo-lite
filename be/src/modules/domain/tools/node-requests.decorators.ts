import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { NodeRequestsGate } from "./node-mode.policy"

/**
 * Token of the reader of what a pinned workflow version's node asks for (its `accounts`): bound by the owner of the workflow
 * versions. Absent, the node-level rights decide nothing and every call is judged by the agent's ticks, as with the switch off.
 */
export const NODE_REQUESTS_GATE: unique symbol = Symbol("domain.tools.node-requests-gate")

/** Injects the reader of a pinned version's node request. Parameter type: NodeRequestsGate. */
export const InjectNodeRequestsGate = (): TypedParameterDecorator<NodeRequestsGate> =>
    injector<NodeRequestsGate>(NODE_REQUESTS_GATE)
