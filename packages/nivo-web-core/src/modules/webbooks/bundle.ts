import type { AgentBundle } from "../agent-bundle"
import { WEBBOOKS_MESSAGES } from "./copy"
import { webbooksModule } from "./declaration"
import { webbooksGuidanceOf } from "./guidance"
import { WEBBOOKS_NODE_MODELS } from "./models"
import { WEBBOOKS_SERVER } from "./server"
import { webbooksAgent } from "./template/webbooks.agent"

/**
 * Everything the Accounting agent adds to the plugin, as ONE value: its module, its catalogue template, its template agent (the graphs and
 * the nodes they place), the weight rows of its AI nodes, its guidance and its words. It installs no tool, label, mode or words of a
 * tool: the CRM tools it names are the plugin's shared vocabulary and the core tools the core package's. `plugin.ts` adds it to `AGENTS`.
 */
export const WEBBOOKS_BUNDLE: AgentBundle = {
    module: webbooksModule,
    server: WEBBOOKS_SERVER,
    agent: webbooksAgent,
    nodeModels: WEBBOOKS_NODE_MODELS,
    guidance: webbooksGuidanceOf,
    messages: WEBBOOKS_MESSAGES,
}
