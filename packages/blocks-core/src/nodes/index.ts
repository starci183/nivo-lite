import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { orderAskMissingNode } from "./order/ask-missing.node"
import { orderCompleteNode } from "./order/complete.node"
import { orderConfirmNode } from "./order/confirm.node"
import { orderRecordNode } from "./order/record.node"
import { paymentRequestNode } from "./payment/request.node"

export { orderAskMissingNode, orderCompleteNode, orderConfirmNode, orderRecordNode, paymentRequestNode }

/**
 * The definitions of every core node, the business logic of the Sales graph: record the order, check it is complete, ask for what is
 * missing, confirm it (the owner decides at the threshold) and ask for the payment. The host runs them; the back end holds none of it.
 */
export const coreNodes: ReadonlyArray<NodeDefinition> = [
    orderRecordNode,
    orderCompleteNode,
    orderAskMissingNode,
    orderConfirmNode,
    paymentRequestNode,
] as unknown as ReadonlyArray<NodeDefinition>
