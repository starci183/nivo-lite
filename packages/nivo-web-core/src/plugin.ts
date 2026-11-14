import { definePlugin, type Plugin } from "@nivo-lite/agent-sdk/installation"
import type { AgentBundle } from "./modules/agent-bundle"
import { WEBBOOKS_BUNDLE } from "./modules/webbooks"
import { webdesk } from "./modules/webdesk"
import { WEBDOCS_BUNDLE } from "./modules/webdocs"
import { WEBMAIL_BUNDLE } from "./modules/webmail"
import { WEBRENEW_BUNDLE } from "./modules/webrenew"
import { websales } from "./modules/websales"
import { CRM_TOOL_LABELS, crmToolWordsOf, crmTools } from "./vocabulary/crm-tools"
import { NIVOWEB_CRM } from "./crm/nivoweb/template"

/** The agents of NIVO Web, in catalogue order. */
const AGENTS: ReadonlyArray<AgentBundle> = [
    WEBMAIL_BUNDLE,
    WEBDOCS_BUNDLE,
    webdesk,
    WEBRENEW_BUNDLE,
    WEBBOOKS_BUNDLE,
    websales,
]

/** The guidance of the agent of one module: the words of the bundle that declares it, empty for any other key. */
const guidanceOf = (moduleKey: string, locale: "vi" | "en"): string =>
    AGENTS.find((agent) => agent.module.key === moduleKey)?.guidance(moduleKey, locale) ?? ""

/**
 * NIVO Web's own business as ONE plugin of the installation (`definePlugin`). Private: only a workspace whose enterprise identifier is
 * `nivo-web` sees, installs and runs its modules; an ordinary workspace never does. It declares the agents of AGENTS-GRAPHS, each a
 * bundle of its module folder (declaration, catalogue template, template agent, node weight rows, guidance, words): the engine installs
 * every graph of every template agent as a workflow template of its module (the agent's `primary` the primary one), and every node the
 * graphs place (`templateNodes`, derived by the installation). It also declares its CRM's operations (`vocabulary/crm-tools.ts`,
 * `nivo.api.crm.nivoweb.*`, served by the engine from the connection's pinned snapshot) with their owner-facing labels (the NODE
 * declares the mode of a call, never the tool). The platform tools its
 * nodes call (the mail and e-invoice reads, the customer link) it only NAMES (`TOOL.*`): the engine defines them
 * (concept.tool-naming#nodeFrame2026_11_12).
 */
export const plugin: Plugin = definePlugin({
    key: "nivo-web-core",
    // The npm name of this package without its scope: the first part of every record type and record read it declares.
    packageName: "nivo-web-core",
    label: { vi: "Nivo Web", en: "Nivo Web" },
    visibility: "private",
    enterprises: ["nivo-web"],
    modules: AGENTS.map((agent) => agent.module),
    servers: AGENTS.map((agent) => agent.server),
    templateAgents: AGENTS.map((agent) => agent.agent),
    // NIVO Web's CRM (`defineProviderTemplate`, id `nivoweb`): the connect wizard lists it, the engine checks a live document against its pin.
    providers: [NIVOWEB_CRM],
    tools: crmTools,
    toolLabels: CRM_TOOL_LABELS,
    nodeModels: Object.fromEntries(AGENTS.flatMap((agent) => Object.entries(agent.nodeModels))),
    messages: Object.fromEntries(AGENTS.map((agent) => [agent.module.namespace, agent.messages] as const)),
    guidance: guidanceOf,
    words: crmToolWordsOf,
})
