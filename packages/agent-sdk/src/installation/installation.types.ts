import type { BlockDefinition } from "../block/block.types"
import type { AnyEntityDefinition } from "../entity/entity-any.types"
import type { JobDefinition } from "../mutation/job"
import type { ModuleDeclaration } from "../module/declaration.types"
import type { Bilingual, ModuleServer } from "../module/module.types"
import type { DataKindDefinition, EffectDefinition, ToolDefinition } from "../node/effect.types"
import type { NodeDefinition } from "../node/node.types"
import type { AnyServiceDefinition } from "../service/service.types"
import type { WebhookEventDefinition } from "../webhook/webhook.types"
import type { AgentMessageKind } from "../team-chat/agent-message-kinds"
import type { WorkflowTemplate } from "../template/workflow-template"
import type { AnyTemplateNode } from "../template/builder/template-node.types"
import type { TemplateAgent } from "../template/builder/graph-builder.types"

/** What the installation needs of a job: a name, `<module>.<job>`. The job runner's definition type satisfies it. */
export interface InstalledJob {
    /** Tells a job from the other lists of the installation. */
    readonly entry: "job"
    /** `<module>.<job>`. */
    readonly name: string
}

/** What the installation needs of an entity: a name, `<module>.<thing>`. The entity engine's definition type satisfies it. */
export interface InstalledEntity {
    /** Tells an entity from the other lists of the installation. */
    readonly entry: "entity"
    /** `<module>.<thing>`. */
    readonly name: string
}

/** Who may see and install the modules of a plugin: every workspace, or only the enterprise workspaces the plugin names. */
export type PluginVisibility = "public" | "private"

/** One tool as the shop owner reads it on an agent's page: whether it acts or reads, a short title and one line. */
export interface PluginToolLabel {
    /** Whether the tool changes something (`acts`) or only reads (`reads`). */
    readonly kind: "acts" | "reads"
    /** The name of the tool, a few words. */
    readonly title: Bilingual
    /** What it lets the agent do, one short line. */
    readonly summary: Bilingual
}

/** What a plugin declares for one of its nodes that calls AI: the model, the weight of the step and the bounds of one call. */
export interface PluginNodeModel {
    /** `auto`, or an explicit model id of the host's vocabulary. */
    readonly model: string
    /** Light (classify, route, a short reply) or heavy (a money decision, a record, a report). */
    readonly weight: "light" | "heavy"
    /** The most completion tokens one call of the node may produce; absent: the host's cap. */
    readonly maxOutputTokens?: number | undefined
    /** The work the node's calls are booked as; absent: node work. */
    readonly work?: "chat_turn" | undefined
}

/** How a provider's key is sent: a bearer token, or a named header. */
export type ProviderTemplateAuth = { readonly type: "bearer" } | { readonly type: "header"; readonly name: string }

/** A name in both product languages. */
interface ProviderTemplateLabel {
    readonly vi: string
    readonly en: string
}

/**
 * A provider a package supports through its OpenAPI document (`defineProviderTemplate`, owner decided 2026-11-14). `kind` is generic (today
 * `crm`); `id` the FIXED, globally unique id (`nivoweb`), declared only here; `openapi` the document the package is written against (its
 * `src/<kind>/<id>/openapi.json`, from which its operation constants are generated); `swaggerPath` where a live system serves its document
 * under the API base URL; `auth` how the key is sent; `baseUrlHint` the example base URL the connect wizard shows; `docs` a documentation link.
 */
export interface ProviderTemplate {
    /** The provider kind. */
    readonly kind: "crm"
    /** The fixed id (`nivoweb`): its provider key is `crm.<id>`, its operations `nivo.api.crm.<id>.<method>.<path>`. */
    readonly id: string
    /** The name the connect wizard shows. */
    readonly label: ProviderTemplateLabel
    /** The pinned OpenAPI document, as the package imports its JSON. */
    readonly openapi: unknown
    /** Where a live system serves its OpenAPI document under the API base URL (`/openapi.json`). */
    readonly swaggerPath: string
    /** How the key is sent. */
    readonly auth: ProviderTemplateAuth
    /** An example API base URL (`https://crm.example.vn/v1`). */
    readonly baseUrlHint: string
    /** A link to the system's documentation, or absent. */
    readonly docs?: string | undefined
}

/** The messages of one module in both product languages. */
export interface PluginMessages {
    /** The Vietnamese words by key. */
    readonly vi: Readonly<Record<string, string>>
    /** The English words by key. */
    readonly en: Readonly<Record<string, string>>
}

/**
 * One package's lists: whatever the package contributes to the installation, each list optional. A package built on the SDK exports
 * ONE such value (`definePlugin`), and the installation is the array of them; the core package is one of them.
 */
export interface InstallationPart<J extends InstalledJob = InstalledJob, E extends InstalledEntity = InstalledEntity> {
    /** The stable key of the plugin (short lowercase ASCII); a part that names none is `part<index>`. */
    readonly key?: string | undefined
    /**
     * The npm name of the package that exports the plugin, without its scope (`blocks-core` for `@nivo-lite/blocks-core`): the first
     * part of every record type and record query it declares (`<package>.<agent>.<domain>`). Declared ONCE here; the project check
     * `record-names` proves it equals the package's `package.json` name. Required of a plugin that declares record types or record reads.
     */
    readonly packageName?: string | undefined
    /** The short display label of the plugin, shown in front of each of its agents (`<label>-<agent name>`); absent: its key. */
    readonly label?: Bilingual | undefined
    /** Who may see and install the plugin's modules; absent: `public`. */
    readonly visibility?: PluginVisibility | undefined
    /**
     * The enterprise identifiers a private plugin belongs to (`nivo-web`): only a workspace whose own enterprise identifier is one of
     * them sees, installs and runs the plugin's modules; an ordinary workspace (no identifier) never matches. Required, non-empty,
     * when `visibility` is `private`; refused otherwise.
     */
    readonly enterprises?: ReadonlyArray<string> | undefined
    /** The modules the package declares: reads, actions, specs and, when it has one, the agent (tool set, ability defaults). */
    readonly modules?: ReadonlyArray<ModuleDeclaration> | undefined
    /** The catalogue half of the package's modules: the template the host installs a module's agent from. */
    readonly servers?: ReadonlyArray<ModuleServer> | undefined
    /** The blocks the package defines, React-free. */
    readonly blocks?: ReadonlyArray<BlockDefinition> | undefined
    /** The graph nodes the package defines. */
    readonly nodes?: ReadonlyArray<NodeDefinition> | undefined
    /** The effects the package's nodes may run. */
    readonly effects?: ReadonlyArray<EffectDefinition> | undefined
    /** The tool definitions the package's nodes may call. */
    readonly tools?: ReadonlyArray<ToolDefinition> | undefined
    /** The data kinds the host's data ports serve. */
    readonly dataKinds?: ReadonlyArray<DataKindDefinition> | undefined
    /** The owner-facing words of the package's tools, by tool id. */
    readonly toolLabels?: Readonly<Record<string, PluginToolLabel>> | undefined
    /** The providers the package supports through their OpenAPI documents (`defineProviderTemplate`); absent: none. */
    readonly providers?: ReadonlyArray<ProviderTemplate> | undefined
    /** The workflow templates the package ships, primary and secondary, every version. */
    readonly templates?: ReadonlyArray<WorkflowTemplate> | undefined
    /**
     * The template nodes the package defines (`defineTemplateNode`), beside its `nodes` (`defineNode`) while the conversion runs: one id is
     * ONE form in the installation. A node its `templateAgents` place need not be listed again: the installation adds every placed node.
     */
    readonly templateNodes?: ReadonlyArray<AnyTemplateNode> | undefined
    /**
     * The template agents the package defines (`defineTemplateAgent`): each with its graphs (`nivo/agent-graph@2`). The engine installs each
     * graph as a workflow template of the agent's module (key = template id, the agent's `primary` the primary one), at ONE version.
     */
    readonly templateAgents?: ReadonlyArray<TemplateAgent> | undefined
    /** What the package declares for each of its nodes that calls AI, by node id. */
    readonly nodeModels?: Readonly<Record<string, PluginNodeModel>> | undefined
    /** The message catalogs of the package's modules, by message namespace. */
    readonly messages?: Readonly<Record<string, PluginMessages>> | undefined
    /** The jobs the package declares. */
    readonly jobs?: ReadonlyArray<J> | undefined
    /** The entities the package declares. */
    readonly entities?: ReadonlyArray<E> | undefined
    /**
     * The services the package ships (`defineService`): business code the engine runs through a contract it knows, never by importing
     * the package. One id is declared once in the installation, and one (contract, module) pair has at most one service.
     */
    readonly services?: ReadonlyArray<AnyServiceDefinition> | undefined
    /**
     * The outgoing events the package offers to webhook subscribers (`defineWebhookEvent`): the owner picks among the installed ones, and
     * the engine validates a subscription against them. One id (`<domain>.<verb>`) is declared once in the installation.
     */
    readonly webhookEvents?: ReadonlyArray<WebhookEventDefinition> | undefined
    /**
     * The kinds of /chat message content the package declares (`defineAgentMessageKind`: an id and the schema of its payload), beside the
     * core kinds of the SDK. The engine stores and delivers a card of a kind the installation lists after checking its payload against
     * that schema and reads nothing else of it; the package builds the payload. One id is declared once in the installation.
     */
    readonly messageKinds?: ReadonlyArray<AgentMessageKind> | undefined
    /**
     * The words the agent of one of the package's modules works under, in a language: its guidance and craft, as ONE text the
     * host puts in front of every model call. Empty for a module that declares no agent. Absent: the modules' agents get no words.
     */
    readonly guidance?: ((moduleKey: string, locale: "vi" | "en") => string) | undefined
    /** The words a model reads for a text key of the package (the title of an effect or a tool); undefined for a key it does not know. */
    readonly words?: ((key: string) => string | undefined) | undefined
}

/**
 * A plugin as its package exports it: a part that names its key and its label (`definePlugin`). Its jobs and entities are, by default,
 * the job runner's and the entity engine's own definitions (`defineJob`, `defineEntity`), so the engine runs them as the installation
 * hands them over.
 */
export type Plugin<J extends InstalledJob = JobDefinition, E extends InstalledEntity = AnyEntityDefinition> = InstallationPart<J, E> &
    Required<Pick<InstallationPart<J, E>, "key" | "label">>

/** A plugin as the installation knows it: who it is, who may use it and the modules it brought. */
export interface InstalledPlugin {
    /** The key of the plugin. */
    readonly key: string
    /** The npm name of its package without the scope (the first part of its record names); null when the part names none. */
    readonly packageName: string | null
    /** The short display label, in both languages. */
    readonly label: Bilingual
    /** Who may see and install its modules. */
    readonly visibility: PluginVisibility
    /** The enterprise identifiers whose workspaces may use it; empty for a public plugin. */
    readonly enterprises: ReadonlyArray<string>
    /** The key of every module the plugin declares (declarations and catalogue templates). */
    readonly modules: ReadonlyArray<string>
    /** The id of every provider template the plugin declares (`defineProviderTemplate`): a template is open where its plugin is. */
    readonly providers: ReadonlyArray<string>
}

/** What the installation holds of one kind of thing, for the hash and the refusals. */
export type InstallationKind =
    | "plugin"
    | "module"
    | "server"
    | "block"
    | "read"
    | "action"
    | "node"
    | "effect"
    | "tool"
    | "data-kind"
    | "tool-label"
    | "provider"
    | "template"
    | "template-node"
    | "template-agent"
    | "template-graph"
    | "node-model"
    | "messages"
    | "job"
    | "entity"
    | "service"
    | "service-slot"
    | "webhook-event"
    | "message-kind"

/** Everything installed: the lists of every package, joined, and the hash of what they hold. */
export interface Installation<J extends InstalledJob = JobDefinition, E extends InstalledEntity = AnyEntityDefinition> {
    /** Every plugin, in part order. */
    readonly plugins: ReadonlyArray<InstalledPlugin>
    /** Every module declaration, in part order. */
    readonly modules: ReadonlyArray<ModuleDeclaration>
    /** Every catalogue template of a module package, in part order. */
    readonly servers: ReadonlyArray<ModuleServer>
    /** Every block definition, in part order. */
    readonly blocks: ReadonlyArray<BlockDefinition>
    /** Every node definition, in part order. */
    readonly nodes: ReadonlyArray<NodeDefinition>
    /** Every effect definition, in part order. */
    readonly effects: ReadonlyArray<EffectDefinition>
    /** Every tool definition, in part order. */
    readonly tools: ReadonlyArray<ToolDefinition>
    /** Every data kind, in part order. */
    readonly dataKinds: ReadonlyArray<DataKindDefinition>
    /** The owner-facing words of every tool, by tool id. */
    readonly toolLabels: Readonly<Record<string, PluginToolLabel>>
    /** Every provider template, in part order; one (kind, id) is declared once in the installation. */
    readonly providers: ReadonlyArray<ProviderTemplate>
    /** Every workflow template, in part order. */
    readonly templates: ReadonlyArray<WorkflowTemplate>
    /** Every template node, in part order: the ones a part lists, then the ones its template agents place that it does not list. */
    readonly templateNodes: ReadonlyArray<AnyTemplateNode>
    /** Every template agent, in part order. */
    readonly templateAgents: ReadonlyArray<TemplateAgent>
    /** What is declared for every node that calls AI, by node id. */
    readonly nodeModels: Readonly<Record<string, PluginNodeModel>>
    /** The message catalogs of every module, by message namespace. */
    readonly messages: Readonly<Record<string, PluginMessages>>
    /** Every job, in part order. */
    readonly jobs: ReadonlyArray<J>
    /** Every entity, in part order. */
    readonly entities: ReadonlyArray<E>
    /** Every service, in part order. */
    readonly services: ReadonlyArray<AnyServiceDefinition>
    /** Every outgoing webhook event, in part order. */
    readonly webhookEvents: ReadonlyArray<WebhookEventDefinition>
    /** Every message kind the packages declare, in part order (the SDK core kinds are not among them). */
    readonly messageKinds: ReadonlyArray<AgentMessageKind>
    /** The words the agent of a module works under, asked of the plugin that declares the module; empty when it gives none. */
    readonly guidanceOf: (moduleKey: string, locale: "vi" | "en") => string
    /** The words a model reads for a text key, asked of each plugin in part order; undefined when none knows the key. */
    readonly wordsOf: (key: string) => string | undefined
    /** The sha-256 hex the generator computed over `registryLinesOf` of the parts; the back end serves its own for comparison. */
    readonly registryHash: string
}
