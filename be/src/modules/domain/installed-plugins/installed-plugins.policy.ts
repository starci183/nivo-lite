import type {
    Installation,
    InstalledPlugin,
    PluginNodeModel,
    ProviderTemplate,
    PluginToolLabel,
} from "@nivo-lite/agent-sdk/installation"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { ModuleAgent, ModuleAgentAbilities, ModuleServer, Bilingual } from "@nivo-lite/agent-sdk/module"
import type { JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import { isServiceOf, type AnyServiceDefinition, type ServiceContract, type ServiceDefinition } from "@nivo-lite/agent-sdk/service"
import type { WebhookEventDefinition } from "@nivo-lite/agent-sdk/webhook"
import type { NodeInstall, ToolDefinition } from "@nivo-lite/agent-sdk/node"
import { agentMessageKindOf, type AgentMessageKind } from "@nivo-lite/agent-sdk/team-chat"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import type { AnyTemplateNode, TemplateAgent, TemplateGraph, WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import type { InstalledPlugins } from "./installed-plugins.contracts"
import { installedStepOf, type InstalledStep } from "./installed-steps.policy"
import { workflowTemplateOfGraph } from "./template-graph-adapter.policy"

/** The weight of a template node that calls AI and has no row in its plugin's model table: a report-like call, as an undeclared step. */
const TEMPLATE_NODE_WEIGHT: PluginNodeModel["weight"] = "heavy"

/** The value of a record under a name it holds itself (never an inherited member), or null. */
const ownOf = <V>(record: Readonly<Record<string, V>>, name: string): V | null =>
    Object.hasOwn(record, name) ? (record[name] ?? null) : null

/** The words of a spec text in both languages: its own, the catalog's of its key, or the fallback. */
const wordsOf = (text: SpecText, fallback: Bilingual, messages: (key: string) => Bilingual | null): Bilingual =>
    "vi" in text ? { vi: text.vi, en: text.en } : (messages(text.key) ?? fallback)

/**
 * A template graph's workflow template as its author catalogued it (`defineTemplateGraph({ catalogue })`, carried on the @2 document):
 * the catalogue's name and line, and its ONE version at the catalogue's number, instant and notes, as a legacy template's version
 * carries them (`version`, `publishedAt`, `changes`). A graph with no catalogue entry keeps what the adapter gives (its title, version 1).
 */
const cataloguedOf = (
    template: WorkflowTemplate,
    graph: TemplateGraph,
    messages: (key: string) => Bilingual | null,
): WorkflowTemplate => {
    const catalogue = graph.spec.catalogue
    if (catalogue === undefined) return template
    const name = wordsOf(catalogue.name, template.name, messages)
    return {
        ...template,
        name,
        summary: wordsOf(catalogue.summary, template.summary, messages),
        versions: template.versions.map((version) => ({
            ...version,
            version: catalogue.version,
            publishedAt: catalogue.publishedAt,
            changes: [wordsOf(catalogue.notes, name, messages)],
        })),
    }
}

/**
 * The installed tools with the engine's own definitions after them. A tool both a plugin and the engine define is a wiring bug (two
 * contracts for one id): refused at load, naming the tool.
 */
export const engineToolsJoined = (
    installed: ReadonlyArray<ToolDefinition>,
    engineTools: ReadonlyArray<ToolDefinition>,
): ReadonlyArray<ToolDefinition> => {
    const engineIds = new Set(engineTools.map((tool) => tool.id))
    const twice = installed.find((tool) => engineIds.has(tool.id))
    if (twice !== undefined) throw new Error(`the tool ${twice.id} is the engine's own; a plugin defines it again`)
    return [...installed, ...engineTools]
}

/**
 * The lookups over one installation: the ONE way the engine asks what the installed plugins declare (the core package is one of
 * them). Pure: the same installation gives the same answers, and nothing here names a package. A module no plugin declares (one the
 * app still defines itself) is the first plugin's, the core package, which the generator always lists first. `engineTools` are the
 * definitions the ENGINE holds of its own native tools (concept.tool-naming#nodeFrame2026_11_12: packages only name tools): they join
 * the installed ones, so a reader of the tools (`nodeInstall().tools`, `toolOf`) knows a native tool whoever defines it; a plugin
 * defining one of them again is refused (`engineToolsJoined`).
 */
export const installedPluginsOf = (
    installation: Installation,
    engineTools: ReadonlyArray<ToolDefinition> = [],
): InstalledPlugins => {
    const tools = engineToolsJoined(installation.tools, engineTools)
    const declarationOf = (moduleKey: string) => installation.modules.find((module) => module.key === moduleKey)
    const agentOf = (moduleKey: string): ModuleAgent | null => declarationOf(moduleKey)?.agent ?? null
    const pluginOfModule = (moduleKey: string): InstalledPlugin | null =>
        installation.plugins.find((plugin) => plugin.modules.includes(moduleKey)) ?? installation.plugins[0] ?? null
    const templateNodeOf = (id: string): AnyTemplateNode | undefined =>
        installation.templateNodes.find((node) => node.id === id)
    const legacyNodeOf = (id: string) => installation.nodes.find((node) => node.id === id)
    // The words of a text key in both languages, from the first message catalog that holds it.
    const messages = (key: string): Bilingual | null => {
        const catalog = Object.values(installation.messages).find((one) => Object.hasOwn(one.vi, key) && Object.hasOwn(one.en, key))
        return catalog === undefined ? null : { vi: catalog.vi[key] ?? key, en: catalog.en[key] ?? key }
    }
    const graphs = installation.templateAgents.flatMap((agent) => agent.graphs.map((graph) => ({ agent, graph })))
    // One workflow template per template graph: computed once, on first use (the install road reads them, never a node's run).
    let adapted: ReadonlyArray<WorkflowTemplate> | null = null
    const templates = (): ReadonlyArray<WorkflowTemplate> => {
        adapted ??= [
            ...installation.templates,
            ...graphs.map(({ agent, graph }) =>
                cataloguedOf(workflowTemplateOfGraph(agent, graph, { legacyNodeOf, templateNodeOf, messages }), graph, messages),
            ),
        ]
        return adapted
    }
    const templateOf = (id: string): WorkflowTemplate | null => templates().find((template) => template.id === id) ?? null
    // What is declared for a node that calls AI. A template node carries its model itself (`defineTemplateNode({ model })`, present
    // exactly when the node calls `ctx.agent.run`): its model wins over the plugin table, whose row (while one exists) still gives the
    // weight, the output bound and the work kind the template node does not carry; a template node with a model and no row weighs heavy,
    // as an undeclared step does. A `defineNode` node reads the table alone.
    const nodeModelOf = (nodeId: string): PluginNodeModel | null => {
        const row = ownOf(installation.nodeModels, nodeId)
        const model = templateNodeOf(nodeId)?.model
        if (model === undefined) return row
        return { ...(row ?? { weight: TEMPLATE_NODE_WEIGHT }), model }
    }
    let modelled: Readonly<Record<string, PluginNodeModel>> | null = null
    const nodeModels = (): Readonly<Record<string, PluginNodeModel>> => {
        modelled ??= Object.fromEntries(
            [...new Set([...Object.keys(installation.nodeModels), ...installation.templateNodes.map((node) => node.id)])].flatMap(
                (id): ReadonlyArray<readonly [string, PluginNodeModel]> => {
                    const declared = nodeModelOf(id)
                    return declared === null ? [] : [[id, declared]]
                },
            ),
        )
        return modelled
    }
    const effectIds: ReadonlySet<string> = new Set(installation.effects.map((effect) => effect.id))
    const install: NodeInstall = {
        nodes: installation.nodes,
        effects: installation.effects,
        tools,
        dataKinds: installation.dataKinds,
        words: installation.wordsOf,
    }
    return {
        plugins: installation.plugins,
        servers: (): ReadonlyArray<ModuleServer> => installation.servers,
        moduleOf: (moduleKey) => declarationOf(moduleKey) ?? null,
        agentOf,
        agentToolsOf: (moduleKey: string): ReadonlyArray<string> | null => agentOf(moduleKey)?.tools ?? null,
        guidanceOf: installation.guidanceOf,
        abilityDefaultsOf: (moduleKey: string): ModuleAgentAbilities | undefined => agentOf(moduleKey)?.abilities,
        toolLabelOf: (tool: string): PluginToolLabel | null => ownOf(installation.toolLabels, tool),
        messageOf: (namespace: string, key: string, locale: "vi" | "en"): string | null => {
            const catalog = ownOf(installation.messages, namespace)
            return catalog === null ? null : ownOf(catalog[locale], key)
        },
        toolOf: (tool: string): ToolDefinition | null => tools.find((one) => one.id === tool) ?? null,
        templates,
        templatesOf: (moduleKey: string): ReadonlyArray<WorkflowTemplate> =>
            templates().filter((template) => template.moduleKey === moduleKey),
        templateOf,
        nodeModelOf,
        nodeModels,
        providers: (): ReadonlyArray<ProviderTemplate> => installation.providers,
        nodeInstall: (): NodeInstall => install,
        entities: (): ReadonlyArray<EntityDefinition> => installation.entities,
        jobs: (): ReadonlyArray<JobDefinition> => installation.jobs,
        services: (): ReadonlyArray<AnyServiceDefinition> => installation.services,
        webhookEvents: (): ReadonlyArray<WebhookEventDefinition> => installation.webhookEvents,
        serviceFor: <T>(contract: ServiceContract<T>, moduleKey: string): ServiceDefinition<T> | null =>
            installation.services.find(
                (service): service is ServiceDefinition<T> => isServiceOf(service, contract) && service.moduleKey === moduleKey,
            ) ?? null,
        messageKindOf: (id: string): AgentMessageKind | null =>
            agentMessageKindOf(installation.messageKinds, id) ?? null,
        templateNodes: (): ReadonlyArray<AnyTemplateNode> => installation.templateNodes,
        templateNodeOf: (id: string): AnyTemplateNode | null => templateNodeOf(id) ?? null,
        stepOf: (id: string): InstalledStep | null =>
            installedStepOf(id, { legacyNodeOf, templateNodeOf, isEffect: (call) => effectIds.has(call) }),
        templateAgents: (): ReadonlyArray<TemplateAgent> => installation.templateAgents,
        templateAgentOf: (key: string): TemplateAgent | null =>
            installation.templateAgents.find((agent) => agent.key === key) ?? null,
        templateGraphOf: (key: string): { readonly agent: TemplateAgent; readonly graph: TemplateGraph } | null =>
            graphs.find((entry) => entry.graph.key === key) ?? null,
        pluginOfModule,
        isOpenTo: (moduleKey: string, enterpriseKey: string | null): boolean => {
            const plugin = pluginOfModule(moduleKey)
            if (plugin === null || plugin.visibility === "public") return true
            return enterpriseKey !== null && plugin.enterprises.includes(enterpriseKey)
        },
    }
}
