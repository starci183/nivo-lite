import type { AgentBundle } from "../agent-bundle"
import { WEBRENEW_MESSAGES } from "./copy"
import { webrenewModule } from "./declaration"
import { webrenewGuidanceOf } from "./guidance"
import { WEBRENEW_NODE_MODELS } from "./models"
import { WEBRENEW_SERVER } from "./server"
import { webrenewAgent } from "./template/webrenew.agent"

/**
 * Everything the Renewal agent adds to the plugin, as ONE value: its module, its catalogue template, its template agent (the graphs and
 * the nodes they place), the weight rows of its AI nodes, its guidance and its words. It installs no tool, label, mode or words of a
 * tool: the CRM tools it names are the plugin's shared vocabulary and the core tools the core package's. `plugin.ts` adds it to `AGENTS`.
 */
export const WEBRENEW_BUNDLE: AgentBundle = {
    module: webrenewModule,
    server: WEBRENEW_SERVER,
    agent: webrenewAgent,
    nodeModels: WEBRENEW_NODE_MODELS,
    guidance: webrenewGuidanceOf,
    messages: WEBRENEW_MESSAGES,
}
