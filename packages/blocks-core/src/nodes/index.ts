import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { coreHandoffNode } from "./core/handoff.node"
import { intentClassifyNode } from "./intent/classify.node"
import { knowledgeAnswerNode } from "./knowledge/answer.node"
import { paymentClaimAckNode } from "./payment/claim-ack.node"

export { coreHandoffNode, intentClassifyNode, knowledgeAnswerNode, paymentClaimAckNode }

/** Every core node, React-free so the back end validates graph specs against them without loading React. */
export const coreNodes: ReadonlyArray<NodeDefinition> = [
    intentClassifyNode,
    knowledgeAnswerNode,
    coreHandoffNode,
    paymentClaimAckNode,
]
