import type { Audience, LensCounts, OptionalId, OptionalOpenGaps, OptionalText } from "./agents.contracts"

/** A module installation (an agent instance) as the agents capability needs it. Owned by the modules lane (module_installations). */
export interface Installation {
    /** The installation. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The module key. */
    readonly module: string
    /** The instance label. */
    readonly name: string
    /** True when the type allows several instances. */
    readonly isMulti: boolean
    /** The agent row of the instance, or null. */
    readonly agentId: string | null
    /** assist or autopilot. */
    readonly operatingMode: string
    /** The instance settings (processor, openclawTimeoutSec...). */
    readonly settings: Readonly<Record<string, unknown>>
    /** The active context version, or null. */
    readonly activeContextVersionId: string | null
}

/** An installation, or null when none matches. */
export type OptionalInstallation = Installation | null

/** Which installation to sync. */
export interface InstallationRef {
    /** The installation. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
}

/** One gate of an applied context with the evidence the owner confirmed. */
export interface ContextGate {
    /** The gate label, in the language of the bundle. */
    readonly label: string
    /** The confirmed evidence. */
    readonly evidence: string
}

/** The active context version of an installation, flattened for the bundle. */
export interface ContextVersion {
    /** The version number. */
    readonly version: number
    /** The summary. */
    readonly summary: string
    /** The gates that have evidence. */
    readonly gates: ReadonlyArray<ContextGate>
    /** The facts worth remembering. */
    readonly facts: ReadonlyArray<string>
    /** The confirmed tone evidence, or an empty text. */
    readonly toneEvidence: string
}

/** A context version, or null when none matches. */
export type OptionalContextVersion = ContextVersion | null

/**
 * The module installations the agents capability reads. The modules lane (L13) implements it over module_installations and
 * module_context_versions; the app root binds it to the token `AGENTS_INSTALLATIONS`.
 */
export interface InstallationDirectory {
    /** The installation of a workspace by id. */
    byId(workspaceId: string, installationId: string): Promise<OptionalInstallation>
    /** The oldest installation of a module in a workspace. */
    firstOfModule(workspaceId: string, module: string): Promise<OptionalInstallation>
    /** The installation that owns an agent. */
    ofAgent(workspaceId: string, agentId: string): Promise<OptionalInstallation>
    /** Up to `limit` installations that run on OpenClaw (settings processor is not "nivo"), of one workspace or of all when null. */
    onOpenclaw(workspaceId: OptionalId, limit: number): Promise<ReadonlyArray<InstallationRef>>
    /** The context version with that id, flattened. */
    contextVersionOf(versionId: string): Promise<OptionalContextVersion>
}

/** One business document an agent may read. */
export interface KnowledgeDocument {
    /** The title. */
    readonly title: string
    /** The topic, or null. */
    readonly topic: string | null
    /** The kind of source. */
    readonly kind: string
    /** Who may see it. */
    readonly visibility: "public" | "internal"
    /** When it was updated, ISO 8601. */
    readonly updatedAt: string
    /** The text. */
    readonly content: string
}

/** One base rule of NIVO (authority, escalation or tone). */
export interface BaseRule {
    /** The title. */
    readonly title: string
    /** The text, markdown. */
    readonly body: string
    /** authority, escalation or tone. */
    readonly kind: string
}

/**
 * The business knowledge an agent may read through its lens (module plus audience). The knowledge lane (L06) implements it;
 * the app root binds it to the token `AGENTS_KNOWLEDGE`.
 */
export interface KnowledgeLens {
    /** Who the module talks to. */
    audienceOf(module: string): Audience
    /** Up to `limit` documents the lens of the module (and instance) may read. */
    sourcesFor(
        workspaceId: string,
        module: string,
        installationId: OptionalId,
        limit: number,
    ): Promise<ReadonlyArray<KnowledgeDocument>>
    /** The standing memory of the shared brain seen through the lens, as markdown ("" when the brain has none). */
    memoryFor(workspaceId: string, module: string, installationId: OptionalId): Promise<string>
    /** The authority, escalation and tone rules of the module folders, module before core. */
    baseRulesOf(folders: ReadonlyArray<string>): Promise<ReadonlyArray<BaseRule>>
    /** Document and fact counts by visibility. */
    countsFor(workspaceId: string, module: string, installationId: OptionalId): Promise<LensCounts>
    /** Up to `limit` open gaps of the module, most asked first; null when the gaps are not kept. */
    openGapsOf(workspaceId: string, module: string, limit: number): Promise<OptionalOpenGaps>
}

/**
 * What the module definitions give the bundle. The modules lane (L13) implements it from the typed catalog and the reply contract
 * constants of the booking, loyalty and hiring lanes; the app root binds it to the token `AGENTS_MODULES`.
 */
export interface ModuleProfiles {
    /** The knowledge folder of a module key, or null when the key is not a module. */
    knowledgeFolderOf(module: string): OptionalText
    /** The reply contract of the module given the base customer contract: the base itself (chatbot), the base with the module addendum (booking, loyalty), its own contract (hiring) or null. */
    replyContractOf(module: string, base: string): OptionalText
    /** The chat-intake clause of the hiring application that the base contract embeds ("" when none). */
    applicationClause(): string
    /** The JSON member of the hiring application that the base contract embeds ("" when none). */
    applicationShape(): string
}
