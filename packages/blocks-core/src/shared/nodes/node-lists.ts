import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { AnyTemplateNode } from "@nivo-lite/agent-sdk/template"
import { bookingBookNode } from "../../agents/booking/nodes/book.node"
import { bookingConfirmNotifyNode } from "../../agents/booking/nodes/confirm-notify.node"
import { bookingConfirmTellNode } from "../../agents/booking/nodes/confirm-tell.node"
import { bookingConfirmNode } from "../../agents/booking/nodes/confirm.node"
import { bookingFindSlotsNode } from "../../agents/booking/nodes/find-slots.node"
import { bookingRemindNode } from "../../agents/booking/nodes/remind.node"
import { chatbotAnswerNode } from "../../agents/chatbot/nodes/answer.node"
import { chatbotComplaintNotifyNode } from "../../agents/chatbot/nodes/complaint-notify.node"
import { chatbotComplaintReplyNode } from "../../agents/chatbot/nodes/complaint-reply.node"
import { chatbotHearNode } from "../../agents/chatbot/nodes/hear.node"
import { chatbotUnderstandNode } from "../../agents/chatbot/nodes/understand.node"
import { contentApprovedNoticeNode } from "../../agents/content/nodes/approved-notice.node"
import { contentDraftNode } from "../../agents/content/nodes/draft.node"
import { contentPlanNode } from "../../agents/content/nodes/plan.node"
import { contentReportNode } from "../../agents/content/nodes/report.node"
import { contentReviewNode } from "../../agents/content/nodes/review.node"
import { coreCallWorkflowNode } from "./core/call-workflow.node"
import { coreForEachNode } from "./core/for-each.node"
import { coreIfNode } from "./core/if.node"
import { coreOutcomeNode } from "./core/outcome.node"
import { hiringDigestNode } from "../../agents/hiring/nodes/digest.node"
import { hiringInviteMoveNode } from "../../agents/hiring/nodes/invite-move.node"
import { hiringInviteNode } from "../../agents/hiring/nodes/invite.node"
import { hiringNotifyNode } from "../../agents/hiring/nodes/notify.node"
import { hiringScreenNode } from "../../agents/hiring/nodes/screen.node"
import type { ViewNode } from "./node-ui"
import { salesAfterSaleNode } from "../../agents/sales/nodes/care-after-sale.node"
import { salesCareDeliveryCheckNode } from "../../agents/sales/nodes/care-delivery-check.node"
import { salesCareDeliveryWaitNode } from "../../agents/sales/nodes/care-delivery-wait.node"
import { salesCareOccasionRearmNode } from "../../agents/sales/nodes/care-occasion-rearm.node"
import { salesCareOccasionWaitNode } from "../../agents/sales/nodes/care-occasion-wait.node"
import { salesCareOccasionNode } from "../../agents/sales/nodes/care-occasion.node"
import { salesCarePlanDeliveryNode } from "../../agents/sales/nodes/care-plan-delivery.node"
import { salesCarePlanOccasionsNode } from "../../agents/sales/nodes/care-plan-occasions.node"
import { salesConsultStageNode } from "../../agents/sales/nodes/consult-stage.node"
import { salesConsultTurnNode } from "../../agents/sales/nodes/consult-turn.node"
import { salesOccasionKeepNode } from "../../agents/sales/nodes/occasion-keep.node"
import { salesOrderCreateNode } from "../../agents/sales/nodes/order-create.node"
import { salesCancelPaidNoticeNode } from "../../agents/sales/nodes/cancel-paid-notice.node"
import { salesAwaitingOrdersNode } from "../../agents/sales/nodes/awaiting-orders.node"
import { salesOrderPaidNode } from "../../agents/sales/nodes/order-paid.node"
import { salesPaymentShortNode } from "../../agents/sales/nodes/payment-short.node"
import { salesCreditTallyNode } from "../../agents/sales/nodes/credit-tally.node"
import { salesOrderTellNode } from "../../agents/sales/nodes/order-tell.node"
import { salesRequestQrNode } from "../../agents/sales/nodes/request-qr.node"
import { salesOrderTalkNode } from "../../agents/sales/nodes/order-talk.node"
import { salesOrderReadNode } from "../../agents/sales/nodes/order-read.node"
import { salesPaymentRemindNode } from "../../agents/sales/nodes/payment-remind.node"
import { salesCreditReadNode } from "../../agents/sales/nodes/credit-read.node"
import { salesCreditNoticeNode } from "../../agents/sales/nodes/credit-notice.node"
import { salesNotSaleNoticeNode } from "../../agents/sales/nodes/not-sale-notice.node"
import { salesPaidClaimReplyNode } from "../../agents/sales/nodes/paid-claim-reply.node"
import { salesPaidClaimNoticeNode } from "../../agents/sales/nodes/paid-claim-notice.node"
import { salesOrderCancelTellNode } from "../../agents/sales/nodes/order-cancel-tell.node"
import { salesOrderCancelNode } from "../../agents/sales/nodes/order-cancel.node"
import { salesWebOrderKeepNode } from "../../agents/sales/nodes/web-order-keep.node"
import { salesWebOrderLeadNode } from "../../agents/sales/nodes/web-order-lead.node"
import { salesWebOrderNoticeNode } from "../../agents/sales/nodes/web-order-notice.node"
import { teamAnswerPostNode } from "../team-chat/team/answer-post.node"
import { teamChatNode } from "../team-chat/team/team-chat.node"
import { teamDeclinedNoticeNode } from "../team-chat/team/declined-notice.node"
import { teamTruthProposeNode } from "../team-chat/team/truth-propose.node"
import { videoComposeNode } from "../../agents/video/nodes/compose.node"
import { videoKeepNode } from "../../agents/video/nodes/keep.node"
import { videoLinksNode } from "../../agents/video/nodes/links.node"
import { videoOutputNode } from "../../agents/video/nodes/output.node"
import { videoRenderCheckNode } from "../../agents/video/nodes/render-check.node"
import { videoPublishNode } from "../../agents/video/nodes/publish.node"
import { videoResultNode } from "../../agents/video/nodes/result.node"
import { videoReviewNode } from "../../agents/video/nodes/review.node"
import { videoScenesNode } from "../../agents/video/nodes/scenes.node"
import { videoScriptNode } from "../../agents/video/nodes/script.node"
import { videoStuckNode } from "../../agents/video/nodes/stuck.node"
import { videoVoiceNode } from "../../agents/video/nodes/voice.node"

/**
 * The control steps a `nivo/agent-graph@2` graph compiles to (`core.call-workflow`, `core.for-each`, `core.outcome`) and the old data
 * condition `core.if`: package nodes (`defineNode`) the installation keeps, since the engine reads a control step's role and effects from
 * them (the back end's template-graph adapter: `legacyNodeOf`). Every business step is a template node (`coreTemplateNodes`).
 */
export const coreControlNodes: ReadonlyArray<NodeDefinition> = [
    coreCallWorkflowNode,
    coreForEachNode,
    coreOutcomeNode,
    coreIfNode,
]

/**
 * Every template node of blocks-core (`defineTemplateNode`), the steps its agents' graphs place, listed here without the graphs so the
 * React-free views (the node cards, the graph view, the ref options) read them without compiling a graph. A spec proves the list is
 * exactly the set the agents place.
 */
export const coreTemplateNodes: ReadonlyArray<AnyTemplateNode> = [
    chatbotHearNode,
    chatbotUnderstandNode,
    chatbotAnswerNode,
    chatbotComplaintReplyNode,
    chatbotComplaintNotifyNode,
    teamChatNode,
    teamTruthProposeNode,
    teamAnswerPostNode,
    teamDeclinedNoticeNode,
    salesConsultTurnNode,
    salesOccasionKeepNode,
    salesOrderCancelNode,
    salesOrderCancelTellNode,
    salesCancelPaidNoticeNode,
    salesOrderCreateNode,
    salesOrderTellNode,
    salesRequestQrNode,
    salesOrderTalkNode,
    salesOrderReadNode,
    salesPaymentRemindNode,
    salesCreditReadNode,
    salesCreditNoticeNode,
    salesNotSaleNoticeNode,
    salesPaidClaimReplyNode,
    salesPaidClaimNoticeNode,
    salesAwaitingOrdersNode,
    salesOrderPaidNode,
    salesPaymentShortNode,
    salesCreditTallyNode,
    salesAfterSaleNode,
    salesConsultStageNode,
    salesCarePlanDeliveryNode,
    salesCarePlanOccasionsNode,
    salesCareDeliveryWaitNode,
    salesCareDeliveryCheckNode,
    salesCareOccasionWaitNode,
    salesCareOccasionNode,
    salesCareOccasionRearmNode,
    salesWebOrderLeadNode,
    salesWebOrderKeepNode,
    salesWebOrderNoticeNode,
    bookingFindSlotsNode,
    bookingBookNode,
    bookingConfirmNode,
    bookingConfirmTellNode,
    bookingConfirmNotifyNode,
    bookingRemindNode,
    hiringScreenNode,
    hiringNotifyNode,
    hiringInviteNode,
    hiringInviteMoveNode,
    hiringDigestNode,
    videoScriptNode,
    videoScenesNode,
    videoResultNode,
    videoKeepNode,
    videoVoiceNode,
    videoLinksNode,
    videoComposeNode,
    videoRenderCheckNode,
    videoOutputNode,
    videoReviewNode,
    videoPublishNode,
    videoStuckNode,
    contentPlanNode,
    contentDraftNode,
    contentReviewNode,
    contentApprovedNoticeNode,
    contentReportNode,
]

/** Every step blocks-core installs, as the editor and the graph views read them: the control steps, then the template nodes. */
export const coreNodeViews: ReadonlyArray<ViewNode> = [...coreControlNodes, ...coreTemplateNodes]
