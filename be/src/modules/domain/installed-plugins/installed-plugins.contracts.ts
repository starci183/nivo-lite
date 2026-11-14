import type {
    InstalledPlugin,
    PluginNodeModel,
    ProviderTemplate,
    PluginToolLabel,
} from "@nivo-lite/agent-sdk/installation"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { ModuleAgent, ModuleAgentAbilities, ModuleDeclaration, ModuleServer } from "@nivo-lite/agent-sdk/module"
import type { JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import type { AnyServiceDefinition, ServiceContract, ServiceDefinition } from "@nivo-lite/agent-sdk/service"
import type { WebhookEventDefinition } from "@nivo-lite/agent-sdk/webhook"
import type { NodeInstall, ToolDefinition } from "@nivo-lite/agent-sdk/node"
import type { AgentMessageKind } from "@nivo-lite/agent-sdk/team-chat"
import type { AnyTemplateNode, TemplateAgent, TemplateGraph, WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import type { OptionalInstalledStep } from "./installed-steps.policy"

/** A module's declaration, or null when no installed plugin declares the module. */
export type OptionalModuleDeclaration = ModuleDeclaration | null

/** A module agent, or null when a module declares none or is unknown. */
export type OptionalModuleAgent = ModuleAgent | null

/** A module's agent tool set, or null when it declares no agent. */
export type OptionalAgentTools = ReadonlyArray<string> | null

/** The language an agent's guidance is read in. */
export type GuidanceLocale = "vi" | "en"

/** A module's default agent abilities, or undefined when it declares none. */
export type OptionalAgentAbilities = ModuleAgentAbilities | undefined

/** The owner-facing words of a tool, or null for a tool no plugin labels. */
export type OptionalToolLabel = PluginToolLabel | null

/** A tool definition, or null when the id names none. */
export type OptionalToolDefinition = ToolDefinition | null

/** A workflow template, or null when the id names none. */
export type OptionalWorkflowTemplate = WorkflowTemplate | null

/** What is declared for a node that calls AI, or null for a node that calls none. */
export type OptionalNodeModel = PluginNodeModel | null

/** What is declared for every node that calls AI, by node id. */
export type NodeModelsById = Readonly<Record<string, PluginNodeModel>>

/** A template node (`defineTemplateNode`), or null when the id names none. */
export type OptionalTemplateNode = AnyTemplateNode | null

/** A template agent (`defineTemplateAgent`), or null when the key names none. */
export type OptionalTemplateAgent = TemplateAgent | null

/** A template graph with the agent it belongs to, or null when the key names none. */
export type OptionalAgentGraph = { readonly agent: TemplateAgent; readonly graph: TemplateGraph } | null

/** The service that implements a contract for a module, or null when no installed plugin ships one. */
export type OptionalService<T> = ServiceDefinition<T> | null

/** A plugin, or null when no plugin matches. */
export type OptionalInstalledPlugin = InstalledPlugin | null

/** A workspace's enterprise identifier, or null for an ordinary workspace. */
export type OptionalEnterpriseKey = string | null

/**
 * What the engine may ask of the installed plugins (the array the installation is made of; the core package is one of them). Every
 * declaration the engine runs by is read through these lookups, never from a package by name.
 */
export interface InstalledPlugins {
    /** Every plugin, in installation order (the core package first). */
    readonly plugins: ReadonlyArray<InstalledPlugin>
    /** The catalogue templates of the module packages, in installation order. */
    readonly servers: () => ReadonlyArray<ModuleServer>
    /** The declaration of a module (its reads and actions among them), or null when no installed plugin declares it. */
    readonly moduleOf: (moduleKey: string) => OptionalModuleDeclaration
    /** The agent a module declares (tool set, ability defaults), or null when it declares none or is unknown. */
    readonly agentOf: (moduleKey: string) => OptionalModuleAgent
    /** The tool set a module declares for its agent, or null when it declares no agent. */
    readonly agentToolsOf: (moduleKey: string) => OptionalAgentTools
    /** The words the agent of a module works under, in a language; empty when its plugin gives none. */
    readonly guidanceOf: (moduleKey: string, locale: GuidanceLocale) => string
    /** The default abilities a module declares for its agent, or undefined when it declares none. */
    readonly abilityDefaultsOf: (moduleKey: string) => OptionalAgentAbilities
    /** The owner-facing words of a tool, or null for a tool no plugin labels. */
    readonly toolLabelOf: (tool: string) => OptionalToolLabel
    /** The words of a key of a plugin's message catalog (`messages` of the installation, by namespace) in a language, or null when it holds none. */
    readonly messageOf: (namespace: string, key: string, locale: GuidanceLocale) => string | null
    /** The definition of a tool by id, or null. */
    readonly toolOf: (tool: string) => OptionalToolDefinition
    /**
     * Every workflow template, in installation order: the ones the plugins ship (`templates`), then one per graph of each template agent
     * (`templateAgents`, `nivo/agent-graph@2`), read as the engine's graph by `graphOfSpecV2`, at ONE version.
     */
    readonly templates: () => ReadonlyArray<WorkflowTemplate>
    /** The workflow templates of one module, primary and secondary, in installation order. */
    readonly templatesOf: (moduleKey: string) => ReadonlyArray<WorkflowTemplate>
    /** The workflow template of an id (`<module>.<slug>`), or null. */
    readonly templateOf: (id: string) => OptionalWorkflowTemplate
    /** What is declared for a node that calls AI, or null for a node that calls none (or is unknown). */
    readonly nodeModelOf: (nodeId: string) => OptionalNodeModel
    /** What is declared for every node that calls AI, by node id. */
    readonly nodeModels: () => NodeModelsById
    /**
     * The outside systems the plugins work with through a pinned OpenAPI document (`{ key: "crm", dataKind: "customers" }`), in
     * installation order; a key is declared once and is never `nivo`.
     */
    readonly providers: () => ReadonlyArray<ProviderTemplate>
    /** Every template node (`defineTemplateNode`), in installation order: the ones listed and the ones the template agents place. */
    readonly templateNodes: () => ReadonlyArray<AnyTemplateNode>
    /** The template node of an id, or null: the node host runs a step of this id as a template node. */
    readonly templateNodeOf: (id: string) => OptionalTemplateNode
    /** Every template agent, in installation order. */
    readonly templateAgents: () => ReadonlyArray<TemplateAgent>
    /** The template agent of a key (its module key), or null. */
    readonly templateAgentOf: (key: string) => OptionalTemplateAgent
    /** The template graph of a key (`<module>.<workflow>`, its workflow template id) with its agent, or null. */
    readonly templateGraphOf: (key: string) => OptionalAgentGraph
    /**
     * The installed step of an id WHICHEVER form declares it (a template node, or a `defineNode` control node), as one typed view (its
     * title, the calls it may make, whether it sends, its model, `blocking`, its lead facts), or null: the ONE reader every per-step
     * decision goes through.
     */
    readonly stepOf: (id: string) => OptionalInstalledStep
    /** The nodes, effects, tools, data kinds and model words the step runner and the seed are wired with. */
    readonly nodeInstall: () => NodeInstall
    /** Every entity the plugins declare, in installation order: the catalog the entity engine and the entity planner are wired with. */
    readonly entities: () => ReadonlyArray<EntityDefinition>
    /** Every job the plugins declare, in installation order: the list the module-jobs runner looks a delivery up in by name. */
    readonly jobs: () => ReadonlyArray<JobDefinition>
    /** Every service the plugins ship, in installation order. */
    readonly services: () => ReadonlyArray<AnyServiceDefinition>
    /** Every outgoing webhook event the plugins declare, in installation order: the events a webhook subscriber may pick. */
    readonly webhookEvents: () => ReadonlyArray<WebhookEventDefinition>
    /**
     * The service that implements `contract` for the agent of `moduleKey`, typed by the contract, or null when no installed plugin ships
     * one: the ONE way the engine reaches business code a plugin ships, never by importing the plugin.
     */
    readonly serviceFor: <T>(contract: ServiceContract<T>, moduleKey: string) => OptionalService<T>
    /**
     * The kind of /chat message content a plugin registers (`messageKinds`) under this id, with its payload schema and commands; null when
     * no plugin declares it (the SDK core kinds are the engine's own and are not answered here). The engine stores a card of a registered
     * kind after checking its payload against this schema and reads nothing else of it.
     */
    readonly messageKindOf: (id: string) => AgentMessageKind | null
    /** The plugin a module belongs to; a module no plugin declares is the core package's. Null only for an empty installation. */
    readonly pluginOfModule: (moduleKey: string) => OptionalInstalledPlugin
    /**
     * Whether a workspace may see, install and run a module: always for a module of a public plugin; for a module of a private plugin
     * only when the workspace's enterprise identifier is one the plugin names (an ordinary workspace, with none, never).
     */
    readonly isOpenTo: (moduleKey: string, enterpriseKey: OptionalEnterpriseKey) => boolean
}
