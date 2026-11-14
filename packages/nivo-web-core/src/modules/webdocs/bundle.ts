import type { AgentBundle } from "../agent-bundle"
import { WEBDOCS_MESSAGES } from "./copy"
import { webdocsModule } from "./declaration"
import { webdocsGuidanceOf } from "./guidance"
import { WEBDOCS_NODE_MODELS } from "./models"
import { WEBDOCS_SERVER } from "./server"
import { webdocsAgent } from "./template/webdocs.agent"

/**
 * Everything the Paperwork agent adds to the plugin, as ONE value: its module, its catalogue template, its template agent (the graphs and
 * the nodes they place), the weight rows of its AI nodes, its guidance and its words. It installs no tool, label, mode or words of a
 * tool: the CRM tools it names are the plugin's shared vocabulary and the core tools the core package's. `plugin.ts` adds it to `AGENTS`.
 */
export const WEBDOCS_BUNDLE: AgentBundle = {
    module: webdocsModule,
    server: WEBDOCS_SERVER,
    agent: webdocsAgent,
    nodeModels: WEBDOCS_NODE_MODELS,
    guidance: webdocsGuidanceOf,
    messages: WEBDOCS_MESSAGES,
}
