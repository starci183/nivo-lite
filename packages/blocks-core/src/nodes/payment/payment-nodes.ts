import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { paymentSettleNode } from "./settle.node"

/** The nodes of the payment capability a shipped template uses: the settlement that marks the matched order paid. */
export const paymentNodes: ReadonlyArray<NodeDefinition> = [paymentSettleNode]
