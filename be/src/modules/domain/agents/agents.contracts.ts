import type { Access, Purpose } from "@modules/domain/agent-connections"
import type { SyncFile } from "@modules/integrations/openclaw"

/** Whether the agent engine can run a generation right now. */
export type EngineAvailability = "ready" | "not_configured" | "offline"

/** An agent as the instance list shows it. */
export interface AgentSummary {
    /** The agent. */
    readonly id: string
    /** The module the agent belongs to. */
    readonly module: string
    /** The display name. */
    readonly name: string
    /** The @handle, unique in the workspace. */
    readonly handle: string
    /** The one-line role. */
    readonly role: string
    /** active or paused. */
    readonly status: string
    /** When the agent was created, ISO 8601. */
    readonly createdAt: string
}

/** The agent that speaks for a department. */
export interface AgentRef {
    /** The agent. */
    readonly id: string
    /** The display name. */
    readonly name: string
}

/** An agent reference, or null when none matches. */
export type OptionalAgentRef = AgentRef | null

/** What creating an agent takes. */
export interface NewAgent {
    /** The workspace. */
    readonly workspaceId: string
    /** The module. */
    readonly module: string
    /** The display name. */
    readonly name: string
    /** The @handle, free in the workspace. */
    readonly handle: string
    /** The one-line role. */
    readonly role: string
    /** The owner-facing instructions. */
    readonly instructions: string
}

/** The free texts of an agent the owner edits. */
export interface AgentTexts {
    /** The instructions. */
    readonly instructions: string
    /** The business notes. */
    readonly knowledge: string
}

/** The persona of an agent as the bundle writes it. */
export interface AgentPersona {
    /** The display name. */
    readonly name: string
    /** The @handle. */
    readonly handle: string
    /** The role. */
    readonly role: string
    /** The owner's instructions. */
    readonly instructions: string
    /** The owner's business notes, or null. */
    readonly knowledge: string | null
    /** The approval rule, or null. */
    readonly approvalRule: string | null
}

/** A persona, or null when none matches. */
export type OptionalAgentPersona = AgentPersona | null

/** One region's data, or the fact that it could not be read: a failed region fails in place and never takes the page down. */
export type Region<T> = { readonly ok: true; readonly data: T } | { readonly ok: false }

/** One line of a list region of the dashboard: a decision waiting, or something the agent finished. */
export interface DashboardItem {
    /** The work item. */
    readonly id: string
    /** The one-line summary, clipped; empty when the item has none (the page shows the action label). */
    readonly title: string
    /** The action key, for the label. */
    readonly action: string
    /** The customer the item is about, or an empty text. */
    readonly customer: string
    /** When it was raised (waiting) or finished (done), ISO 8601. */
    readonly at: string
    /** The lead the item is about, or null. */
    readonly leadId: string | null
    /** The href the finished work recorded as its evidence, or null. */
    readonly resultHref: string | null
}

/** The decisions of the module that wait for a person: the oldest few and the total. */
export interface WaitingData {
    /** How many wait. */
    readonly total: number
    /** The oldest few. */
    readonly items: ReadonlyArray<DashboardItem>
}

/** The work finished by policy in the last seven days: the latest few and the count. */
export interface DoneData {
    /** How many finished. */
    readonly count: number
    /** The latest few. */
    readonly items: ReadonlyArray<DashboardItem>
}

/** One connection bound to the agent. */
export interface ConnectionItem {
    /** The connection. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** The provider key; the page labels it. */
    readonly provider: string
    /** connected, error or pending. */
    readonly status: "connected" | "error" | "pending"
    /** What the agent may do through it. */
    readonly access: Access
    /** What the agent uses it for. */
    readonly purpose: Purpose
}

/** Who the agent talks to: customers or the team. */
export type Audience = "customer" | "internal"

/** How many documents the agent can read, by visibility. */
export interface DocumentCounts {
    /** Documents anyone may see. */
    readonly public: number
    /** Documents for the team. */
    readonly internal: number
}

/** How many facts the agent can read, by visibility. */
export interface FactCounts {
    /** Facts anyone may see. */
    readonly public: number
    /** Facts for the team. */
    readonly internal: number
    /** Facts restricted to named agents. */
    readonly restricted: number
}

/** What the agent can read: document and fact counts by visibility. */
export interface LensCounts {
    /** The audience of the lens. */
    readonly audience: Audience
    /** Documents by visibility. */
    readonly documents: DocumentCounts
    /** Facts by visibility. */
    readonly facts: FactCounts
}

/** One question the agent could not answer. */
export interface KnowledgeGap {
    /** The gap. */
    readonly id: string
    /** The question, clipped. */
    readonly question: string
    /** How often it was asked. */
    readonly count: number
    /** When it was last asked, ISO 8601. */
    readonly lastSeenAt: string
}

/** The open gaps of a module: the count and the most asked few. */
export interface OpenGaps {
    /** How many gaps are open. */
    readonly openCount: number
    /** The most asked few. */
    readonly items: ReadonlyArray<KnowledgeGap>
}

/** The open gaps, or null when the reader may not see them or they are not kept. */
export type OptionalOpenGaps = OpenGaps | null

/** What the agent can read and, for a manager, what it could not answer. */
export interface KnowledgeData extends LensCounts {
    /** The open gaps; null when the reader is not a manager or the gaps are not kept. */
    readonly gaps: OptionalOpenGaps
}

/** The installed agent of the dashboard. */
export interface DashboardAgent {
    /** The agent. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** assist or autopilot. */
    readonly mode: string
}

/** Everything the common regions of an agent dashboard need for one module. */
export interface AgentDashboardData {
    /** The installed agent, or null when the module has none yet. */
    readonly agent: DashboardAgent | null
    /** The decisions waiting for a person. */
    readonly waiting: Region<WaitingData>
    /** The work finished by policy in seven days. */
    readonly done: Region<DoneData>
    /** The connections bound to the agent. */
    readonly connections: Region<ReadonlyArray<ConnectionItem>>
    /** What the agent can read. */
    readonly knowledge: Region<KnowledgeData>
}

/** Which dashboard to load. */
export interface DashboardQuery {
    /** The workspace. */
    readonly workspaceId: string
    /** The module. */
    readonly module: string
    /** The instance whose dashboard it is; the type's first installation when absent. */
    readonly installationId?: string | null
}

/** The OpenClaw copy of one agent, built only from Supabase. */
export interface AgentBundle {
    /** The installation. */
    readonly installationId: string
    /** The workspace. */
    readonly workspaceId: string
    /** The module. */
    readonly module: string
    /** The OpenClaw agent id. */
    readonly agentId: string
    /** The display name. */
    readonly agentName: string
    /** The active context version, or null. */
    readonly contextVersion: number | null
    /** Who the agent talks to. */
    readonly audience: Audience
    /** AGENTS.md, SOUL.md and knowledge/*.md. */
    readonly files: ReadonlyArray<SyncFile>
}

/** Who answers a module's customers. */
export type Processor = "nivo" | "openclaw"

/** Whether the agent engine is usable, for the Agents page. */
export interface EngineStatus {
    /** True when a gateway address and credential are configured. */
    readonly gatewayConfigured: boolean
    /** True when the agent workspaces can be written. */
    readonly workspaceWritable: boolean
    /** The last time a sync of the workspace ran, or null when none ever did. */
    readonly lastSyncCheckAt: string | null
    /** True when the last sync check is younger than the freshness window. */
    readonly syncFresh: boolean
}

/** The values that fill the `{{name}}` placeholders of a message. */
export type TextParams = Readonly<Record<string, string | number>>

/** Looks a message up in the bundle language. */
export type TextOf = (key: string, params?: TextParams) => string

/** A knowledge source as AGENTS.md inlines it. */
export interface SourceText {
    /** The title. */
    readonly title: string
    /** The full text. */
    readonly content: string
}

/** The sections of AGENTS.md before they are joined. */
export interface AgentsMdInput {
    /** The agent display name. */
    readonly name: string
    /** The module key. */
    readonly module: string
    /** Who the agent talks to. */
    readonly audience: Audience
    /** The persona, or null when the installation has no agent row. */
    readonly persona: OptionalAgentPersona
    /** The authority and escalation rules, already trimmed to their budget. */
    readonly rules: ReadonlyArray<BaseRuleText>
    /** The applied context, or null. */
    readonly version: OptionalContextVersionText
    /** The standing memory of the brain, or an empty text. */
    readonly memory: string
    /** The titles and full text of the knowledge sources. */
    readonly sources: ReadonlyArray<SourceText>
    /** The reply contract of the module, or null. */
    readonly contract: string | null
    /** The tools section. */
    readonly tools: string
}

/** A rule already trimmed to its budget. */
export interface BaseRuleText {
    /** The title. */
    readonly title: string
    /** The trimmed plain text. */
    readonly text: string
}

/** The active context version as text. */
export interface AppliedContext {
    /** The version number. */
    readonly version: number
    /** The text. */
    readonly text: string
}

/** The applied context as text, or null when none is applied. */
export type OptionalContextVersionText = AppliedContext | null

/** One tool of the bridge as AGENTS.md lists it. */
export interface ToolListing {
    /** The tool name. */
    readonly name: string
    /** What it does. */
    readonly description: string
    /** The arguments and their types. */
    readonly args: Readonly<Record<string, string>>
}

/** An id, or null when there is none. */
export type OptionalId = string | null

/** A text, or null when there is none. */
export type OptionalText = string | null

/** The settings of an installation: a free-form bag the modules lane owns. */
export interface InstallationSettings {
    /** Any setting. */
    readonly [key: string]: unknown
}

/** Settings, or nothing when the installation has none. */
export type OptionalSettings = InstallationSettings | null | undefined
