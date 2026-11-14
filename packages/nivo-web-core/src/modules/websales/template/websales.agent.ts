import { type TemplateAgent, defineTemplateAgent } from "@nivo-lite/agent-sdk/template"
import { websalesText } from "../copy"
import { WEBSALES_PROVIDERS } from "../websales.accounts"
import { closeGraph } from "./close.graph"
import { enquiryGraph } from "./enquiry.graph"
import { linkGraph } from "./link.graph"
import { mailEnquiriesGraph } from "./mail-enquiries.graph"
import { roundGraph } from "./round.graph"
import { teamChatGraph } from "./team-chat.graph"
import { wonGraph } from "./won.graph"

/**
 * The Sales agent template: the follow-up round (primary), the enquiry, the close and the link a person starts, the mailed enquiries,
 * the hand-over once the money is in, and the team chat turn, in version 1's catalogue order. It works with the CRM, the messaging
 * accounts and the sending mailbox (census §7: crm, zalo_oa, telegram, meta, smtp, in that order). Hidden graphs (C3 readiness):
 * every graph but the team chat without the CRM; the enquiry also without any messaging account (it answers a conversation); the round
 * and the close also when neither a messaging account nor the sending mailbox is attached (their customer-telling step blocks and
 * lists both as alternatives). The won hand-over and the mailed enquiries tell the customer only in side steps.
 */
export const websalesAgent: TemplateAgent = defineTemplateAgent({
    key: "websales",
    label: websalesText("agent.label"),
    accounts: [...WEBSALES_PROVIDERS],
    graphs: [roundGraph, enquiryGraph, closeGraph, linkGraph, mailEnquiriesGraph, wonGraph, teamChatGraph],
    primary: roundGraph.key,
})
