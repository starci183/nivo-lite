import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { coreHandoffNode } from "./core/handoff.node"
import { raiseWorkItemNode } from "./core/raise-work-item.node"
import { intentClassifyNode } from "./intent/classify.node"
import { knowledgeAnswerNode } from "./knowledge/answer.node"
import { orderAskMissingNode } from "./order/ask-missing.node"
import { orderCompleteNode } from "./order/complete.node"
import { orderConfirmNode } from "./order/confirm.node"
import { orderNeedsApprovalNode } from "./order/needs-approval.node"
import { orderRecordNode } from "./order/record.node"
import { paymentClaimAckNode } from "./payment/claim-ack.node"
import { paymentRequestNode } from "./payment/request.node"

export {
    coreHandoffNode,
    intentClassifyNode,
    knowledgeAnswerNode,
    orderAskMissingNode,
    orderCompleteNode,
    orderConfirmNode,
    orderNeedsApprovalNode,
    orderRecordNode,
    paymentClaimAckNode,
    paymentRequestNode,
    raiseWorkItemNode,
}

/**
 * Every core node, React-free so the back end validates graph specs against them without loading React. The business logic of the
 * Chatbot, Sales and Accounting graphs lives here; the host runs the nodes and the back end holds none of it.
 */
export const coreNodes: ReadonlyArray<NodeDefinition> = [
    intentClassifyNode,
    knowledgeAnswerNode,
    coreHandoffNode,
    paymentClaimAckNode,
    orderRecordNode,
    orderCompleteNode,
    orderAskMissingNode,
    orderNeedsApprovalNode,
    orderConfirmNode,
    raiseWorkItemNode,
    paymentRequestNode,
] as unknown as ReadonlyArray<NodeDefinition>
