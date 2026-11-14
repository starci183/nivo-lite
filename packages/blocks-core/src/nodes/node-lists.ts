import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { AnyTemplateNode } from "@nivo-lite/agent-sdk/template"
import { bookingBookNode } from "./booking/book.node"
import { bookingConfirmNotifyNode } from "./booking/confirm-notify.node"
import { bookingConfirmTellNode } from "./booking/confirm-tell.node"
import { bookingConfirmNode } from "./booking/confirm.node"
import { bookingFindSlotsNode } from "./booking/find-slots.node"
import { bookingRemindNode } from "./booking/remind.node"
import { chatbotAnswerNode } from "./chatbot/answer.node"
import { chatbotComplaintNotifyNode } from "./chatbot/complaint-notify.node"
import { chatbotComplaintReplyNode } from "./chatbot/complaint-reply.node"
import { chatbotHearNode } from "./chatbot/hear.node"
import { chatbotUnderstandNode } from "./chatbot/understand.node"
import { contentApprovedNoticeNode } from "./content/approved-notice.node"
import { contentDraftNode } from "./content/draft.node"
import { contentPlanNode } from "./content/plan.node"
import { contentReportNode } from "./content/report.node"
import { contentReviewNode } from "./content/review.node"
import { coreCallWorkflowNode } from "./core/call-workflow.node"
import { coreForEachNode } from "./core/for-each.node"
import { coreIfNode } from "./core/if.node"
import { coreOutcomeNode } from "./core/outcome.node"
import { hiringDigestNode } from "./hiring/digest.node"
import { hiringInviteMoveNode } from "./hiring/invite-move.node"
import { hiringInviteNode } from "./hiring/invite.node"
import { hiringNotifyNode } from "./hiring/notify.node"
import { hiringScreenNode } from "./hiring/screen.node"
import type { ViewNode } from "./node-ui"
import { salesAfterSaleNode } from "./sales/care-after-sale.node"
import { salesCareDeliveryCheckNode } from "./sales/care-delivery-check.node"
import { salesCareDeliveryWaitNode } from "./sales/care-delivery-wait.node"
import { salesCareOccasionRearmNode } from "./sales/care-occasion-rearm.node"
import { salesCareOccasionWaitNode } from "./sales/care-occasion-wait.node"
import { salesCareOccasionNode } from "./sales/care-occasion.node"
import { salesCarePlanDeliveryNode } from "./sales/care-plan-delivery.node"
import { salesCarePlanOccasionsNode } from "./sales/care-plan-occasions.node"
import { salesConsultStageNode } from "./sales/consult-stage.node"
import { salesConsultTurnNode } from "./sales/consult-turn.node"
import { salesOccasionKeepNode } from "./sales/occasion-keep.node"
import { salesOrderCreateNode } from "./sales/order-create.node"
import { salesCancelPaidNoticeNode } from "./sales/cancel-paid-notice.node"
import { salesAwaitingOrdersNode } from "./sales/awaiting-orders.node"
import { salesOrderPaidNode } from "./sales/order-paid.node"
import { salesPaymentShortNode } from "./sales/payment-short.node"
import { salesCreditTallyNode } from "./sales/credit-tally.node"
import { salesOrderTellNode } from "./sales/order-tell.node"
import { salesRequestQrNode } from "./sales/request-qr.node"
import { salesOrderTalkNode } from "./sales/order-talk.node"
import { salesOrderReadNode } from "./sales/order-read.node"
import { salesPaymentRemindNode } from "./sales/payment-remind.node"
import { salesCreditReadNode } from "./sales/credit-read.node"
import { salesCreditNoticeNode } from "./sales/credit-notice.node"
import { salesNotSaleNoticeNode } from "./sales/not-sale-notice.node"
import { salesUnpaidNoticeNode } from "./sales/unpaid-notice.node"
import { salesPaidClaimReplyNode } from "./sales/paid-claim-reply.node"
import { salesPaidClaimNoticeNode } from "./sales/paid-claim-notice.node"
import { salesOrderCancelTellNode } from "./sales/order-cancel-tell.node"
import { salesOrderCancelNode } from "./sales/order-cancel.node"
import { salesWebOrderKeepNode } from "./sales/web-order-keep.node"
import { salesWebOrderLeadNode } from "./sales/web-order-lead.node"
import { salesWebOrderNoticeNode } from "./sales/web-order-notice.node"
import { teamAnswerPostNode } from "./team/answer-post.node"
import { teamChatNode } from "./team/team-chat.node"
import { teamDeclinedNoticeNode } from "./team/declined-notice.node"
import { teamUnsentNoticeNode } from "./team/unsent-notice.node"
import { teamTruthProposeNode } from "./team/truth-propose.node"
import { videoComposeNode } from "./video/compose.node"
import { videoKeepNode } from "./video/keep.node"
import { videoLinksNode } from "./video/links.node"
import { videoOutputNode } from "./video/output.node"
import { videoRenderCheckNode } from "./video/render-check.node"
import { videoPublishNode } from "./video/publish.node"
import { videoResultNode } from "./video/result.node"
import { videoReviewNode } from "./video/review.node"
import { videoScenesNode } from "./video/scenes.node"
import { videoScriptNode } from "./video/script.node"
import { videoStuckNode } from "./video/stuck.node"
import { videoVoiceNode } from "./video/voice.node"

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
    teamUnsentNoticeNode,
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
    salesUnpaidNoticeNode,
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
