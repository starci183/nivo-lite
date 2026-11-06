import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { accountingPostPaymentNode } from "./accounting/post-payment.node"
import { accountingLedgerReadyNode } from "./accounting/ledger-ready.node"
import { chatbotDraftReplyNode } from "./chatbot/draft-reply.node"
import { coreHandoffNode } from "./core/handoff.node"
import { raiseWorkItemNode } from "./core/raise-work-item.node"
import { coreReplyNode } from "./core/reply.node"
import { intentClassifyNode } from "./intent/classify.node"
import { intentHasNode } from "./intent/has.node"
import { knowledgeAnswerNode } from "./knowledge/answer.node"
import { orderAskMissingNode } from "./order/ask-missing.node"
import { orderCompleteNode } from "./order/complete.node"
import { orderConfirmNode } from "./order/confirm.node"
import { orderNeedsApprovalNode } from "./order/needs-approval.node"
import { salesLeadFromMessageNode } from "./sales/lead-from-message.node"
import { salesOrderFromChatNode } from "./sales/order-from-chat.node"
import { paymentNodes } from "./payment/payment-nodes"
import { paymentClaimAckNode } from "./payment/claim-ack.node"
import { paymentRequestSepayNode } from "./payment/request-sepay.node"

/**
 * Every core node, React-free so the back end validates graph specs against them without loading React. The business logic of the
 * Chatbot, Sales and Accounting graphs lives here; the host runs the nodes and the back end holds none of it.
 */
export const coreNodes: ReadonlyArray<NodeDefinition> = [
    intentClassifyNode,
    intentHasNode,
    knowledgeAnswerNode,
    salesLeadFromMessageNode,
    chatbotDraftReplyNode,
    coreHandoffNode,
    coreReplyNode,
    paymentClaimAckNode,
    salesOrderFromChatNode,
    orderCompleteNode,
    orderAskMissingNode,
    orderNeedsApprovalNode,
    orderConfirmNode,
    raiseWorkItemNode,
    paymentRequestSepayNode,
    ...paymentNodes,
    accountingLedgerReadyNode,
    accountingPostPaymentNode,
]
