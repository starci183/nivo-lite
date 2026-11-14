import type { TemplateNode } from "@nivo-lite/agent-sdk/template"
import { websalesAcceptNode } from "./accept.node"
import { websalesAskNode } from "./ask.node"
import { websalesRoundMessageNode } from "./round-message.node"
import { websalesCloseFindNode } from "./close-find.node"
import { websalesCloseNotifyNode } from "./close-notify.node"
import { websalesCustomerProposeNode } from "./customer-propose.node"
import { websalesDueNode } from "./due.node"
import { websalesFollowRecordNode } from "./follow-record.node"
import { websalesFollowSendNode } from "./follow-send.node"
import { websalesHandoverNotifyNode } from "./handover-notify.node"
import { websalesHeardNotifyNode } from "./heard-notify.node"
import { websalesHeardReplyNode } from "./heard-reply.node"
import { websalesLinkFindNode } from "./link-find.node"
import { websalesLinkNotifyNode } from "./link-notify.node"
import { websalesLinkWriteNode } from "./link-write.node"
import { websalesLostNotifyNode } from "./lost-notify.node"
import { websalesMailNotifyNode } from "./mail-notify.node"
import { websalesMailPurchaseOpenNode } from "./mail-purchase-open.node"
import { websalesMailReplyDraftNode } from "./mail-reply-draft.node"
import { websalesMailUnderstandNode } from "./mail-understand.node"
import { websalesPaidTellNode } from "./paid-tell.node"
import { websalesPayInstructNode } from "./pay-instruct.node"
import { websalesPurchaseLoseNode } from "./purchase-lose.node"
import { websalesPurchaseNoteNode } from "./purchase-note.node"
import { websalesPurchaseOpenNode } from "./purchase-open.node"
import { websalesQuoteCreateNode } from "./quote-create.node"
import { websalesQuoteSendNode } from "./quote-send.node"
import { websalesRoundReportNode } from "./round-report.node"
import { websalesTeamAnswerNode } from "./team-answer.node"
import { websalesTeamRouteNode } from "./team-route.node"
import { websalesUnderstandNode } from "./understand.node"

/**
 * The template nodes of the Sales agent, one feature each: a new customer's enquiry (open, note, understand; ask; quote create and
 * send; the heard reply and notice; the lose and its notice), the follow-up round (due, follow send and record, report), the chat turn (route the request, answer),
 * the close a person starts (find, settle the customer, accept, say how to pay, tell the team), the link a person starts (find, write,
 * notice), the hand-over once the money is in (the work order, then the customer), and the enquiries that come by mail (open,
 * understand, the reused quote create, the reply draft, the notice).
 */
export const websalesNodes: ReadonlyArray<TemplateNode> = [
    websalesPurchaseOpenNode,
    websalesPurchaseNoteNode,
    websalesUnderstandNode,
    websalesRoundMessageNode,
    websalesAskNode,
    websalesQuoteCreateNode,
    websalesQuoteSendNode,
    websalesHeardReplyNode,
    websalesHeardNotifyNode,
    websalesPurchaseLoseNode,
    websalesLostNotifyNode,
    websalesDueNode,
    websalesFollowSendNode,
    websalesFollowRecordNode,
    websalesRoundReportNode,
    websalesTeamRouteNode,
    websalesTeamAnswerNode,
    websalesCloseFindNode,
    websalesCustomerProposeNode,
    websalesAcceptNode,
    websalesPayInstructNode,
    websalesCloseNotifyNode,
    websalesLinkFindNode,
    websalesLinkWriteNode,
    websalesLinkNotifyNode,
    websalesHandoverNotifyNode,
    websalesPaidTellNode,
    websalesMailPurchaseOpenNode,
    websalesMailUnderstandNode,
    websalesMailReplyDraftNode,
    websalesMailNotifyNode,
]
