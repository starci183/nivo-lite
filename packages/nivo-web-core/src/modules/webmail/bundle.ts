import type { AgentBundle } from "../agent-bundle"
import { WEBMAIL_MESSAGES } from "./copy"
import { webmailModule } from "./declaration"
import { webmailGuidanceOf } from "./guidance"
import { WEBMAIL_NODE_MODELS } from "./models"
import { WEBMAIL_SERVER } from "./server"
import { webmailAgent } from "./template/webmail.agent"

/**
 * Everything the Mailbox agent adds to the plugin, as ONE value: its module, its catalogue template, its template agent (the graphs and
 * the nodes they place), the weight rows of its AI nodes, its guidance and its words. It installs no tool, label, mode or words of a
 * tool: the CRM tools it names are the plugin's shared vocabulary and the core tools the core package's. `plugin.ts` adds it to `AGENTS`.
 */
export const WEBMAIL_BUNDLE: AgentBundle = {
    module: webmailModule,
    server: WEBMAIL_SERVER,
    agent: webmailAgent,
    nodeModels: WEBMAIL_NODE_MODELS,
    guidance: webmailGuidanceOf,
    messages: WEBMAIL_MESSAGES,
}
