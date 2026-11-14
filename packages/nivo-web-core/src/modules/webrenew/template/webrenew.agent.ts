import { type TemplateAgent, defineTemplateAgent } from "@nivo-lite/agent-sdk/template"
import { webrenewText } from "../copy"
import { WEBRENEW_PROVIDERS } from "../webrenew.accounts"
import { answerGraph } from "./answer.graph"
import { mailRepliesGraph } from "./mail-replies.graph"
import { renewGraph } from "./renew.graph"
import { roundGraph } from "./round.graph"
import { teamChatGraph } from "./team-chat.graph"

/**
 * The Renewal agent template: the morning round (primary), the customer's answer, the mail replies, the provider renewal and the team
 * chat turn. It works with the CRM, the messaging accounts and the sending mailbox (census §7: crm, zalo_oa, telegram, meta, smtp, in
 * that order). Hidden graphs (C3 readiness): every graph without the CRM; the round also when neither a messaging account nor the
 * sending mailbox is attached (its send step blocks and lists both as alternatives); the answer without any messaging account (its
 * reply and acknowledgement block). The renewal and the mail replies tell the customer or the team only in side steps. `nivo` (NIVO's
 * own tools) is always of the agent and is not listed.
 */
export const webrenewAgent: TemplateAgent = defineTemplateAgent({
    key: "webrenew",
    label: webrenewText("agent.label"),
    accounts: [...WEBRENEW_PROVIDERS],
    graphs: [roundGraph, answerGraph, mailRepliesGraph, renewGraph, teamChatGraph],
    primary: roundGraph.key,
})
