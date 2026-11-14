import type { AgentBundle } from "../agent-bundle"
import { WEBDESK_MESSAGES } from "./copy"
import { webdeskModule } from "./declaration"
import { webdeskGuidanceOf } from "./guidance"
import { WEBDESK_NODE_MODELS } from "./models"
import { WEBDESK_SERVER } from "./server"
import { webdeskAgent } from "./template/webdesk.agent"

/**
 * Everything the Support agent adds to the plugin, as ONE value: its module, its catalogue template, its template agent (the graphs and
 * the nodes they place), the weight rows of its AI nodes, its guidance and its words. It installs no tool, label, mode or words of a
 * tool: the CRM tools it names are the plugin's shared vocabulary and the core tools the core package's. `plugin.ts` adds it to `AGENTS`.
 */
export const webdesk: AgentBundle = {
    module: webdeskModule,
    server: WEBDESK_SERVER,
    agent: webdeskAgent,
    nodeModels: WEBDESK_NODE_MODELS,
    guidance: webdeskGuidanceOf,
    messages: WEBDESK_MESSAGES,
}
