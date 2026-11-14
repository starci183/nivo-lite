import type { TemplateNode } from "@nivo-lite/agent-sdk/template"
import { webdeskAnswerPlanNode } from "./answer-plan.node"
import { webdeskCheckNode } from "./check.node"
import { webdeskContactLinkNode } from "./contact-link.node"
import { webdeskCustomerReplyNode } from "./customer-reply.node"
import { webdeskIdentifyNode } from "./identify.node"
import { webdeskIntakeLinkedNode } from "./intake-linked.node"
import { webdeskMailReplyDraftNode } from "./mail-reply-draft.node"
import { webdeskPlanNode } from "./plan.node"
import { webdeskTeamAnswerNode } from "./team-answer.node"
import { webdeskTeamTellNode } from "./team-tell.node"
import { webdeskTicketNoteNode } from "./ticket-note.node"
import { webdeskTicketOpenNode } from "./ticket-open.node"
import { webdeskUnderstandSalesNode } from "./understand-sales.node"

/**
 * The steps of the Support agent, one feature each: understand the customer; identify, open the ticket and link the sender (a
 * mailed request); open the ticket of a linked conversation; check first; plan the answer or the mailed plan; tell the team,
 * answer the customer, note the ticket, draft the mail reply; answer the team (`webdesk.team-answer`, converted with the shared
 * team-answer factory).
 */
export const webdeskNodes: ReadonlyArray<TemplateNode> = [
    webdeskUnderstandSalesNode,
    webdeskIdentifyNode,
    webdeskTicketOpenNode,
    webdeskContactLinkNode,
    webdeskIntakeLinkedNode,
    webdeskCheckNode,
    webdeskPlanNode,
    webdeskAnswerPlanNode,
    webdeskTeamTellNode,
    webdeskCustomerReplyNode,
    webdeskTicketNoteNode,
    webdeskMailReplyDraftNode,
    webdeskTeamAnswerNode,
]
