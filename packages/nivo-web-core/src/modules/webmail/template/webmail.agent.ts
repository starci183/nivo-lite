import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { type TemplateAgent, defineTemplateAgent } from "@nivo-lite/agent-sdk/template"
import { webmailText } from "../copy"
import { webmailTeamChatGraph } from "./team-chat.graph"
import { WEBMAIL_TRIAGE_KEY, webmailTriageGraph } from "./triage.graph"

/**
 * The Mailbox agent template: the mail round (primary) and its chat turn with the team. It works with the IMAP mailboxes only (census
 * §7: imap); the round hides while no mailbox is attached (its read blocks); the team chat needs no account. It holds no send of any
 * kind, no CRM and no money.
 */
export const webmailAgent: TemplateAgent = defineTemplateAgent({
    key: "webmail",
    label: webmailText("agent.label"),
    accounts: [PROVIDER.imap],
    graphs: [webmailTriageGraph, webmailTeamChatGraph],
    primary: WEBMAIL_TRIAGE_KEY,
})
