import type { PluginMessages, PluginNodeModel } from "@nivo-lite/agent-sdk/installation"
import type { ModuleDeclaration, ModuleServer } from "@nivo-lite/agent-sdk/module"
import { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS } from "@nivo-lite/agent-sdk/names"
import type { TemplateAgent } from "@nivo-lite/agent-sdk/template"

/**
 * One agent of the plugin as its module hands it over (`plugin.ts` adds each to its `AGENTS` list): the module declaration (the agent's
 * tool set, its default abilities, its policy words, its workbench), the catalogue template, the template agent with its graphs (the
 * engine installs each graph as a workflow template of the module, the agent's `primary` the primary one), the weight rows of its nodes
 * that call AI, its guidance and its words.
 */
export interface AgentBundle {
    /** The module declaration. */
    readonly module: ModuleDeclaration
    /** The catalogue template. */
    readonly server: ModuleServer
    /** The template agent (`defineTemplateAgent`). */
    readonly agent: TemplateAgent
    /**
     * The weight, the output bound and the work kind of each of its own nodes that calls AI, by node id (D8): the model itself is on the
     * template node; a node of another package keeps its own package's row.
     */
    readonly nodeModels: Readonly<Record<string, PluginNodeModel>>
    /** The guidance, by module key and language. */
    readonly guidance: (moduleKey: string, locale: "vi" | "en") => string
    /** The module's words under its namespace (node titles, the workbench spec's text keys). */
    readonly messages: PluginMessages
}

/** The two default sets: the engine adds them to every agent's set (`withDefaultReads`), so no module set lists them. */
const DEFAULTS: ReadonlySet<string> = new Set<string>([...DEFAULT_AI_READ_TOOLS, ...DEFAULT_NODE_TOOLS])

/**
 * Every tool a node of an agent's graphs may call, once each, in graph order: the agent's tool set (`agent.tools` of its declaration),
 * derived from the nodes so it is exactly what the engine holds a published graph to (`GRAPH_TOOL_OUTSIDE_AGENT`). A default tool is
 * never part of it (the engine adds both default sets itself); a node's own listing of one, the AI read its code calls or requires, is
 * the node's.
 */
export const toolsOfAgent = (agent: TemplateAgent): ReadonlyArray<string> => [
    ...new Set(agent.graphs.flatMap((graph) => [...graph.nodes.values()].flatMap((node) => [...node.tools]))),
].filter((tool) => !DEFAULTS.has(tool))
