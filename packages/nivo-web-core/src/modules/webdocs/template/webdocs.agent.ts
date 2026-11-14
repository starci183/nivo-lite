import { type TemplateAgent, defineTemplateAgent } from "@nivo-lite/agent-sdk/template"
import { WEBDOCS_PROVIDERS } from "../../../nodes/webdocs/webdocs.accounts"
import { webdocsText } from "../copy"
import { WEBDOCS_DRAFT_KEY, webdocsDraftGraph } from "./draft.graph"
import { webdocsTeamChatGraph } from "./team-chat.graph"

/**
 * The Paperwork agent template: the draft a workflow asks for (primary) and its chat turn with the team. It works with the CRM only
 * (census §7: crm), and reads only; both graphs hide while no CRM account is attached (their read step blocks).
 */
export const webdocsAgent: TemplateAgent = defineTemplateAgent({
    key: "webdocs",
    label: webdocsText("agent.label"),
    accounts: [...WEBDOCS_PROVIDERS],
    graphs: [webdocsDraftGraph, webdocsTeamChatGraph],
    primary: WEBDOCS_DRAFT_KEY,
})
