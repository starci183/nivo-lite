import type { TemplateNode } from "@nivo-lite/agent-sdk/template"
import { webrenewCloseRecordNode } from "./close-record.node"
import { webrenewCloseTeamNode } from "./close-team.node"
import { webrenewCloseThankNode } from "./close-thank.node"
import { webrenewDueNode } from "./due.node"
import { webrenewMailReplyRecordNode } from "./mail-reply-record.node"
import { webrenewMailReplyTeamNode } from "./mail-reply-team.node"
import { webrenewPaidAckNode } from "./paid-ack.node"
import { webrenewPaidTeamNode } from "./paid-team.node"
import { webrenewQuoteOpenNode } from "./quote-open.node"
import { webrenewQuoteRecordNode } from "./quote-record.node"
import { webrenewQuoteTellNode } from "./quote-tell.node"
import { webrenewRemindRecordNode } from "./remind-record.node"
import { webrenewRemindSendNode } from "./remind-send.node"
import { webrenewRenewNode } from "./renew.node"
import { webrenewRenewedTeamNode } from "./renewed-team.node"
import { webrenewRenewedTellNode } from "./renewed-tell.node"
import { webrenewReplyAnswerNode } from "./reply-answer.node"
import { webrenewRoundReportNode } from "./round-report.node"
import { webrenewTeamAnswerNode } from "./team-answer.node"
import { webrenewUnderstandOpenNode } from "./understand-open.node"
import { webrenewRoundMessageNode } from "./round-message.node"
import { webrenewUnlinkedTellNode } from "./unlinked-tell.node"

/**
 * The steps of the Renewal agent, one feature each: the morning round (find, send each reminder, record it, report), the
 * customer's answer (understand; open each request, tell the quote, record each quote; record each decline, tell the team, thank;
 * answer, tell the team of an unlinked customer; tell the team of a payment, acknowledge it), the mail replies (record, tell the
 * team), the provider renewal (renew, tell the team, tell the customer), and the team chat turn (`webrenew.team-answer`,
 * converted by the factory's slice).
 */
export const webrenewNodes: ReadonlyArray<TemplateNode> = [
    webrenewDueNode,
    webrenewRemindSendNode,
    webrenewRemindRecordNode,
    webrenewRoundReportNode,
    webrenewUnderstandOpenNode,
    webrenewRoundMessageNode,
    webrenewQuoteOpenNode,
    webrenewQuoteTellNode,
    webrenewQuoteRecordNode,
    webrenewCloseRecordNode,
    webrenewCloseTeamNode,
    webrenewCloseThankNode,
    webrenewReplyAnswerNode,
    webrenewUnlinkedTellNode,
    webrenewPaidTeamNode,
    webrenewPaidAckNode,
    webrenewMailReplyRecordNode,
    webrenewMailReplyTeamNode,
    webrenewRenewNode,
    webrenewRenewedTeamNode,
    webrenewRenewedTellNode,
    webrenewTeamAnswerNode,
]
