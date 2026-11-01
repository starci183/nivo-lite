import type { AgentAccess, AgentPurpose } from "./agents-connections.contracts"
import type { DashboardLine } from "./agents-reads.contracts"
import type { AskAsAgentInput, AskedPassage } from "./agent-ask.contracts"
import type {
    AgentAudience,
    LensCounts,
    LensLanes,
    OptionalId,
    OptionalOpenGaps,
    OptionalAgentText,
} from "./agents.contracts"

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
    /** True when the owner switched the agent on. */
    readonly liveEnabled: boolean
    /** True when the agent was removed: only its history is left. */
    readonly removed: boolean
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
    audienceOf(module: string): AgentAudience
    /** Up to `limit` documents the lens of the module (and instance) may read. */
    sourcesFor(
        workspaceId: string,
        module: string,
        installationId: OptionalId,
        limit: number,
    ): Promise<ReadonlyArray<KnowledgeDocument>>
    /** The authority, escalation and tone rules of the module folders, module before core. */
    baseRulesOf(folders: ReadonlyArray<string>): Promise<ReadonlyArray<BaseRule>>
    /** Document and fact counts by visibility. */
    countsFor(workspaceId: string, module: string, installationId: OptionalId): Promise<LensCounts>
    /** Tries a question as an agent: the passages its view reads, then the confirmed facts of the same view. */
    ask(userId: string, workspaceId: string, input: AskAsAgentInput): Promise<ReadonlyArray<AskedPassage>>
    /** Which kinds of knowledge the view of the module reads. */
    lanesOf(module: string): LensLanes
    /** Which kinds of knowledge the public's view reads. */
    customerLanes(): LensLanes
    /** Up to `limit` open gaps of the module, most asked first; null when the gaps are not kept. */
    openGapsOf(workspaceId: string, module: string, limit: number): Promise<OptionalOpenGaps>
}

/**
 * What the module definitions give the bundle. The modules lane (L13) implements it from the typed catalog and the reply contract
 * constants of the booking, loyalty and hiring lanes; the app root binds it to the token `AGENTS_MODULES`.
 */
export interface ModuleProfiles {
    /** The knowledge folder of a module key, or null when the key is not a module. */
    knowledgeFolderOf(module: string): OptionalAgentText
    /** The reply contract of the module given the base customer contract: the base itself (chatbot), the base with the module addendum (booking, loyalty), its own contract (hiring) or null. */
    replyContractOf(module: string, base: string): OptionalAgentText
    /** The chat-intake clause of the hiring application that the base contract embeds ("" when none). */
    applicationClause(): string
    /** The JSON member of the hiring application that the base contract embeds ("" when none). */
    applicationShape(): string
}

/** A connection an agent is bound to, as the dashboard of the agents capability reads it. */
export interface BoundConnectionView {
    /** The connection. */
    readonly id: string
    /** The provider (telegram, zalo_oa...). */
    readonly provider: string
    /** The display name. */
    readonly name: string
    /** The bot username, when the provider has one. */
    readonly botUsername: string | null
    /** The masked bank account, when the connection is a bank feed. */
    readonly accountMasked: string | null
    /** connected, error, pending or disconnected. */
    readonly status: string
    /** What the agent may do through the connection. */
    readonly access: AgentAccess
    /** What the agent uses the connection for. */
    readonly purpose: AgentPurpose
}

/** The connections bound to agents: the port the agent-connections capability implements for the agents dashboard. */
export interface AgentConnectionsDirectory {
    /** The connections an agent is bound to for the purposes, oldest connection first. */
    connectionsFor(agentId: string, purposes: ReadonlyArray<AgentPurpose>): Promise<ReadonlyArray<BoundConnectionView>>
}

/** The scope of one dashboard list of a department's work items. */
export interface WorkListRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The department (module key) whose work is listed. */
    readonly department: string
    /** The instance the list narrows to, or null for the whole department. */
    readonly installationId: string | null
    /** Waiting for a decision, or done alone since a moment. */
    readonly kind: "waiting" | "done"
    /** Done lists only: the earliest completion moment shown. */
    readonly since: Date | null
    /** The text pattern that marks a test run; matching items are left out. */
    readonly testRunPattern: string
    /** The most lines read. */
    readonly limit: number
}

/** The work items the dashboard lists: the port the work-items capability implements for the agents dashboard. */
export interface WorkDashboardDirectory {
    /** The lines of one dashboard list; each carries the count before the limit. */
    dashboardList(query: WorkListRequest): Promise<ReadonlyArray<DashboardLine>>
}
