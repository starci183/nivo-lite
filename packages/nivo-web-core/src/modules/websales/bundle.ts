import type { AgentBundle } from "../agent-bundle"
import { WEBSALES_MESSAGES } from "./copy"
import { websalesModule } from "./declaration"
import { websalesGuidanceOf } from "./guidance"
import { WEBSALES_NODE_MODELS } from "./models"
import { WEBSALES_SERVER } from "./server"
import { websalesAgent } from "./template/websales.agent"

/**
 * Everything the Sales agent adds to the plugin, as ONE value: its module, its catalogue template, its template agent (the graphs and
 * the nodes they place), the weight rows of its AI nodes, its guidance and its words. It installs no tool, label, mode or words of a
 * tool: the CRM tools it names are the plugin's shared vocabulary and the core tools the core package's. `plugin.ts` adds it to `AGENTS`.
 */
export const websales: AgentBundle = {
    module: websalesModule,
    server: WEBSALES_SERVER,
    agent: websalesAgent,
    nodeModels: WEBSALES_NODE_MODELS,
    guidance: websalesGuidanceOf,
    messages: WEBSALES_MESSAGES,
}
