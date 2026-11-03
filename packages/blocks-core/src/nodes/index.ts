import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { paymentNodes } from "./payment"

export { paymentNodes }

/** Every node of the core capabilities (intent, knowledge, order, payment, core), the list the host and the graph spec validate against. */
export const coreNodes: ReadonlyArray<NodeDefinition> = [...paymentNodes]
