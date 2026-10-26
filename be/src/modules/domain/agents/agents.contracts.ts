import type { Access, Purpose } from "@modules/domain/agent-connections"
import type { SyncFile } from "@modules/integrations/openclaw"
import type { WorkspaceRole } from "@modules/domain/workspace-members"

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
    /** The HTTPS address of the agent's picture, or null for the generated avatar. */
    readonly avatarUrl: string | null
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
    /** The workbench link that opens this decision. */
    readonly decisionHref: string
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
    /** The bot username, when the provider has one. */
    readonly botUsername: string | null
    /** The masked bank account, when the connection is a bank feed. */
    readonly accountMasked: string | null
    /** connected, error or pending. */
    readonly status: "connected" | "error" | "pending"
    /** What the agent may do through it. */
    readonly access: Access
    /** What the agent uses it for. */
    readonly purpose: Purpose
}

/** Who the agent talks to: customers or the team. */
export type AgentAudience = "customer" | "internal"

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

/** Which kinds of knowledge a view reads: documents and facts by who may read them. */
export interface LensLanes {
    /** Documents anyone may see. */
    readonly documentPublic: boolean
    /** Documents for the team. */
    readonly documentInternal: boolean
    /** Facts anyone may see. */
    readonly factPublic: boolean
    /** Facts for the team. */
    readonly factInternal: boolean
    /** Facts restricted to named agents. */
    readonly factRestricted: boolean
}

/** One view of the shared knowledge: the customer's, or the one of an installed agent. */
export interface AgentKnowledgeLens {
    /** customer for the public's view, agent for an installed agent. */
    readonly kind: "customer" | "agent"
    /** The agent, or null for the customer. */
    readonly agentId: string | null
    /** The instance the view is scoped to, or null. */
    readonly installationId: string | null
    /** The module of the agent, or null for the customer. */
    readonly module: string | null
    /** The display name of the agent, or null for the customer. */
    readonly name: string | null
    /** The picture of the agent, or null. */
    readonly avatarUrl: string | null
    /** The audience of the view. */
    readonly audience: AgentAudience
    /** What the view reads of each kind of knowledge, in the order a person reads them. */
    readonly cells: ReadonlyArray<LensCell>
}

/** The kinds of shared knowledge a view can read. */
export type LensLaneKey = keyof LensLanes

/** What one view reads of one kind of knowledge. */
export interface LensCell {
    /** The kind of knowledge. */
    readonly lane: LensLaneKey
    /** Whether the view may read it, by the policy that builds the view. */
    readonly isOpen: boolean
    /** How many items the view reads of it, or null when they are not counted (the customer's view). */
    readonly count: number | null
}

/** What the agent can read: document and fact counts by visibility. */
export interface LensCounts {
    /** The audience of the lens. */
    readonly audience: AgentAudience
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
    readonly audience: AgentAudience
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
    readonly audience: AgentAudience
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

/** The HTTPS address of an agent picture, or null for the generated avatar. */
export type OptionalAvatarUrl = string | null

/** A text, or null when there is none. */
export type OptionalAgentText = string | null

/** The settings of an installation: a free-form bag the modules lane owns. */
export interface InstallationSettings {
    /** Any setting. */
    readonly [key: string]: unknown
}

/** Settings, or nothing when the installation has none. */
export type OptionalSettings = InstallationSettings | null | undefined

/** What an agent's prompt needs to speak as it. */
export interface AgentProfile {
    /** The agent. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** The @handle. */
    readonly handle: string
    /** The one-line role. */
    readonly role: string
    /** The owner's instructions. */
    readonly instructions: string
    /** The owner's business notes. */
    readonly knowledge: string
    /** The approval rule. */
    readonly approval_rule: string
}

/** An agent profile, or null when none matches. */
export type OptionalAgentProfile = AgentProfile | null

/** A person of the workspace as the Office names them; `roomId` is the key of the department room they sit in, or null. */
export interface MemberRef {
    /** The workspace member (workspace_members.id), never the sign-in account. */
    readonly memberId: string
    /** The name the Office shows. */
    readonly name: string
    /** The workspace role. */
    readonly role: WorkspaceRole
    /** The department room key the person sits in, or null when they sit in none. */
    readonly roomId: string | null
}

/** Who answers for an agent right now: the person its stuck, rejected or expired work goes to, and who comes after them. */
export interface AgentOwners {
    /** The member that answers now: the stored owner, else the stored fallback, else the workspace owner. */
    readonly ownerMemberId: string
    /** The member after them (the stored fallback or the workspace owner), or null when nobody else is active. */
    readonly fallbackMemberId: string | null
}

/** What a manager sets about the ownership of one agent: a full replacement of the five settings. */
export interface OwnershipChange {
    /** The member in charge of the agent. */
    readonly ownerMemberId: string
    /** The member who takes over when the owner left or is disabled. */
    readonly fallbackMemberId: string
    /** The workspace roles that may hand the agent work. */
    readonly assignableRoles: ReadonlyArray<string>
    /** The department rooms (keys) whose members may hand the agent work. */
    readonly assignableRooms: ReadonlyArray<string>
    /** The other agents it may pass work to. */
    readonly canTagAgentIds: ReadonlyArray<string>
}

/** A department room as the ownership page names it. */
export interface RoomLabel {
    /** The room key. */
    readonly key: string
    /** The display name. */
    readonly name: string
}

/** An agent another agent may pass work to. */
export interface TagTarget {
    /** The agent. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** The module it belongs to. */
    readonly module: string
    /** active or paused. */
    readonly status: string
}

/** A person in charge of an agent, with whether they can answer today. */
export interface OwnerCard extends MemberRef {
    /** False when the member was removed or disabled. */
    readonly active: boolean
}

/** Everything the profile page says about who answers for an agent, who may give it work and who it may pass work to. */
export interface AgentOwnership {
    /** The agent. */
    readonly agentId: string
    /** The stored owner, or null when the member is gone. */
    readonly owner: OwnerCard | null
    /** The stored fallback, or null when the member is gone. */
    readonly fallback: OwnerCard | null
    /** Who answers right now (the owner, else the fallback, else the workspace owner). */
    readonly responder: AgentOwners
    /** The roles that may hand the agent work. */
    readonly assignableRoles: ReadonlyArray<WorkspaceRole>
    /** The rooms whose members may hand the agent work. */
    readonly assignableRooms: ReadonlyArray<RoomLabel>
    /** The agents it may pass work to. */
    readonly canTag: ReadonlyArray<TagTarget>
}
