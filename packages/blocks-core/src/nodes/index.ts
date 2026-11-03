import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { coreHandoffNode } from "./core/handoff.node"
import { coreReplyNode } from "./core/reply.node"
import { intentClassifyNode } from "./intent/classify.node"
import { intentHasNode } from "./intent/has.node"
import { knowledgeAnswerNode } from "./knowledge/answer.node"
import { paymentClaimAckNode } from "./payment/claim-ack.node"

export { coreHandoffNode, coreReplyNode, intentClassifyNode, intentHasNode, knowledgeAnswerNode, paymentClaimAckNode }

/** Every core node, React-free so the back end validates graph specs against them without loading React. */
export const coreNodes: ReadonlyArray<NodeDefinition> = [
    intentClassifyNode,
    intentHasNode,
    knowledgeAnswerNode,
    coreHandoffNode,
    coreReplyNode,
    paymentClaimAckNode,
]
