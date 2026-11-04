import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { accountingLedgerAppendNode } from "./accounting/ledger-append.node"
import { accountingLedgerReadyNode } from "./accounting/ledger-ready.node"
import { coreHandoffNode } from "./core/handoff.node"
import { raiseWorkItemNode } from "./core/raise-work-item.node"
import { coreReplyNode } from "./core/reply.node"
import { intentClassifyNode } from "./intent/classify.node"
import { intentHasNode } from "./intent/has.node"
import { leadEnsureNode } from "./lead/ensure.node"
import { knowledgeAnswerNode } from "./knowledge/answer.node"
import { orderAskMissingNode } from "./order/ask-missing.node"
import { orderCompleteNode } from "./order/complete.node"
import { orderConfirmNode } from "./order/confirm.node"
import { orderNeedsApprovalNode } from "./order/needs-approval.node"
import { orderRecordNode } from "./order/record.node"
import { paymentNodes } from "./payment/payment-nodes"
import { paymentClaimAckNode } from "./payment/claim-ack.node"
import { paymentRequestNode } from "./payment/request.node"

/**
 * Every core node, React-free so the back end validates graph specs against them without loading React. The business logic of the
 * Chatbot, Sales and Accounting graphs lives here; the host runs the nodes and the back end holds none of it.
 */
export const coreNodes: ReadonlyArray<NodeDefinition> = [
    intentClassifyNode,
    intentHasNode,
    knowledgeAnswerNode,
    leadEnsureNode,
    coreHandoffNode,
    coreReplyNode,
    paymentClaimAckNode,
    orderRecordNode,
    orderCompleteNode,
    orderAskMissingNode,
    orderNeedsApprovalNode,
    orderConfirmNode,
    raiseWorkItemNode,
    paymentRequestNode,
    ...paymentNodes,
    accountingLedgerReadyNode,
    accountingLedgerAppendNode,
]
