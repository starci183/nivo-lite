import { type TemplateAgent, defineTemplateAgent } from "@nivo-lite/agent-sdk/template"
import { WEBDESK_PROVIDERS } from "../../../nodes/webdesk/webdesk.accounts"
import { webdeskText } from "../copy"
import { WEBDESK_FRONT_KEY, webdeskFrontGraph } from "./front.graph"
import { webdeskMailTicketsGraph } from "./mail-tickets.graph"
import { webdeskTeamChatGraph } from "./team-chat.graph"
import { webdeskTicketGraph } from "./ticket.graph"

/**
 * The Support agent template: the front door of the company's Zalo OA (primary), the incident it hands a fault to, the tickets of the
 * mails the Mailbox hands on, and its chat turn with the team. It works with the CRM, the messaging accounts and the mail account (census
 * §7: crm, zalo_oa, telegram, meta, smtp, in that order). The front door hides while no messaging account is attached (its answer
 * steps block), the incident and the mailed tickets while no CRM account is (their ticket writes block); without SMTP only the mail
 * reply draft is skipped (a side step).
 */
export const webdeskAgent: TemplateAgent = defineTemplateAgent({
    key: "webdesk",
    label: webdeskText("agent.label"),
    accounts: [...WEBDESK_PROVIDERS],
    graphs: [webdeskFrontGraph, webdeskTicketGraph, webdeskMailTicketsGraph, webdeskTeamChatGraph],
    primary: WEBDESK_FRONT_KEY,
})
