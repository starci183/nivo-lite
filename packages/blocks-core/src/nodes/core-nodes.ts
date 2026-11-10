import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { accountingReportNode } from "./accounting/report.node"
import { accountingMatchPaymentNode } from "./accounting/match-payment.node"
import { accountingPostPaymentNode } from "./accounting/post-payment.node"
import { chatbotAnswerNode } from "./chatbot/answer.node"
import { chatbotComplaintNode } from "./chatbot/complaint.node"
import { chatbotUnderstandNode } from "./chatbot/understand.node"
import { coreCallWorkflowNode } from "./core/call-workflow.node"
import { coreForEachNode } from "./core/for-each.node"
import { coreIfNode } from "./core/if.node"
import { coreOutcomeNode } from "./core/outcome.node"
import { salesAfterSaleNode } from "./sales/care-after-sale.node"
import { salesCareDeliveryCheckNode } from "./sales/care-delivery-check.node"
import { salesCareOccasionNode } from "./sales/care-occasion.node"
import { salesCarePlanNode } from "./sales/care-plan.node"
import { salesPaymentReminderNode } from "./sales/payment-reminder.node"
import { salesUnpaidNoticeNode } from "./sales/unpaid-notice.node"
import { salesOrderNoticeNode } from "./sales/order-notice.node"
import { salesConsultTurnNode } from "./sales/consult-turn.node"
import { salesCreateOrderNode } from "./order/create.node"
import { salesWebOrderNode } from "./sales/web-order.node"
import { paymentReceivedNoticeNode } from "./payment/received-notice.node"
import { paymentNodes } from "./payment/payment-nodes"
import { paymentRequestNode } from "./payment/request.node"

/**
 * Every core node, React-free so the back end validates graph specs against them without loading React. The business logic of the
 * Chatbot, Sales and Accounting graphs lives here; the host runs the nodes and the back end holds none of it. Only the steps a shipped
 * workflow template uses are listed (plus the engine's loop, `core.for-each`).
 */
export const coreNodes: ReadonlyArray<NodeDefinition> = [
    chatbotUnderstandNode,
    chatbotAnswerNode,
    chatbotComplaintNode,
    coreCallWorkflowNode,
    coreForEachNode,
    coreOutcomeNode,
    coreIfNode,
    salesConsultTurnNode,
    salesCreateOrderNode,
    salesOrderNoticeNode,
    salesWebOrderNode,
    salesAfterSaleNode,
    salesCarePlanNode,
    salesCareDeliveryCheckNode,
    salesCareOccasionNode,
    salesPaymentReminderNode,
    salesUnpaidNoticeNode,
    paymentReceivedNoticeNode,
    paymentRequestNode,
    ...paymentNodes,
    accountingMatchPaymentNode,
    accountingPostPaymentNode,
    accountingReportNode,
]
