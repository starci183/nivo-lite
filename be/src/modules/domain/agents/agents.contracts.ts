import type { RunUsage, SyncFile } from "@modules/integrations/openclaw"
import type { Locale } from "@modules/platform/i18n"

/** Who speaks a line of a generation prompt. */
export type GenMessageRole = "system" | "user" | "assistant"

/** One line of the prompt of a generation. */
export interface GenMessage {
    /** Who speaks it. */
    readonly role: GenMessageRole
    /** The text. */
    readonly content: string
}

/** What shape the generated text must have: plain text or one JSON object (the caller still parses it). */
export type ResponseFormat = "text" | "json"

/** What a caller asks the agent engine to write. */
export interface GenerateParams {
    /** The workspace the text is written for. */
    readonly workspaceId: string
    /** What the text is for (setup_chat, owner_chat, relay, classify_lead...): evidence and the usage page group by it. */
    readonly purpose: string
    /** The prompt: system instructions, the dialogue so far and the input as the last line. */
    readonly messages: ReadonlyArray<GenMessage>
    /** Text or one JSON object. */
    readonly responseFormat: ResponseFormat
    /** How long the caller waits, ms (default 45 s, between 5 s and 120 s). Past it the generation is cancelled. */
    readonly timeoutMs?: number
    /** The usage kind the metering records the text under. */
    readonly kind: string
    /** The usage module the metering records the text under. */
    readonly module: string
    /** The language of the sentence a failure carries; Vietnamese when absent. */
    readonly locale?: Locale
}

/** What a finished generation cost. */
export type GenerationUsage = RunUsage

/** A generation that produced text. */
export interface GenerationSuccess {
    /** Discriminant of the success half. */
    readonly ok: true
    /** The generated text. */
    readonly output: string
    /** The ai_generations row. */
    readonly generationId: string
    /** Milliseconds from the start of the run to each named mark. */
    readonly timings: Readonly<Record<string, number>>
    /** What the run cost, or null when the gateway reported none. */
    readonly usage: GenerationUsage | null
}

/** Why a generation did not produce text. */
export type GenerationFailureReason = "quota" | "engine_offline" | "timeout" | "error" | "not_configured"

/** A generation that did not produce text. */
export interface GenerationFailure {
    /** Discriminant of the failure half. */
    readonly ok: false
    /** Why. */
    readonly reason: GenerationFailureReason
    /** The sentence to show, already in the request language. */
    readonly message: string
}

/** The result of one generation. */
export type GenerationOutcome = GenerationSuccess | GenerationFailure

/** The prompt and the limits stored with a queued generation. */
export interface GenerationInput {
    /** The prompt lines. */
    readonly messages: ReadonlyArray<GenMessage>
    /** Text or JSON. */
    readonly responseFormat: ResponseFormat
    /** The deadline of the caller, ms. */
    readonly timeoutMs: number
}

/** A queued generation as the runner reads it. */
export interface QueuedGeneration {
    /** The ai_generations row. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** What the text is for. */
    readonly purpose: string
    /** The usage module. */
    readonly module: string
    /** The usage kind. */
    readonly usageKind: string
    /** The status of the row. */
    readonly status: string
    /** The prompt and limits. */
    readonly input: GenerationInput
}

/** The part of a generation row the caller polls. */
export interface GenerationProgress {
    /** queued, running, done, error or cancelled. */
    readonly status: string
    /** The text, when the run is done. */
    readonly text: string | null
    /** The usage the run reported. */
    readonly usage: GenerationUsage | null
    /** The marks the run reported. */
    readonly timings: Readonly<Record<string, number>>
}

/** A generation's progress, or null when the row is gone. */
export type OptionalGenerationProgress = GenerationProgress | null

/** A queued generation, or null when none matches. */
export type OptionalQueuedGeneration = QueuedGeneration | null

/** Whether the agent engine can run a generation right now. */
export type EngineAvailability = "ready" | "not_configured" | "offline"

/** What the runner did with a queued generation: text written, failure written, or the row was no longer waiting. */
export type GenerationRunStatus = "done" | "error" | "dropped"

/** How an agent may use a connection. */
export type Access = "read" | "ask" | "auto"

/** What an agent uses a connection for. */
export type Purpose = "inbound_chat" | "outbound_chat" | "bank_feed" | "data_source" | "tool" | "lead_source"

/** An active agent bound to a connection. */
export interface BoundAgent {
    /** The agent. */
    readonly id: string
    /** The module the agent belongs to. */
    readonly module: string
    /** The display name. */
    readonly name: string
    /** What the agent may do through the connection. */
    readonly access: Access
    /** What the agent uses the connection for. */
    readonly purpose: Purpose
}

/** A connection an agent is bound to. */
export interface BoundConnection {
    /** The connection. */
    readonly id: string
    /** The provider (telegram, zalo_oa...). */
    readonly provider: string
    /** The display name. */
    readonly name: string
    /** connected, error, pending or disconnected. */
    readonly status: string
    /** What the agent may do through the connection. */
    readonly access: Access
    /** What the agent uses the connection for. */
    readonly purpose: Purpose
}

/** Which bindings of a connection count. */
export interface AgentsForOptions {
    /** A binding whose access is "read" does not count: the agent may look, not act or answer. */
    readonly acting?: boolean
    /** Only agents of these modules count. */
    readonly modules?: ReadonlyArray<string>
}

/** Which bindings of an agent count. */
export interface ConnectionsForOptions {
    /** A binding whose access is "read" does not count. */
    readonly acting?: boolean
    /** Only connections whose status is "connected" count. */
    readonly connectedOnly?: boolean
    /** Only connections of these providers count. */
    readonly providers?: ReadonlyArray<string>
}

/** The inbound chat of a connection: the front door agent and the agents it hands over to. */
export interface InboundRoute {
    /** The agent that answers first, or null when none is bound. */
    readonly front: BoundAgent | null
    /** One agent per other module, reached by intent. */
    readonly handovers: ReadonlyArray<BoundAgent>
}

/** One grant of a connection to an agent. */
export interface BindingGrant {
    /** The workspace of both. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The connection. */
    readonly connectionId: string
    /** What the agent uses it for. */
    readonly purpose: Purpose
    /** What the agent may do through it. */
    readonly access: Access
}

/** One binding to remove. */
export interface BindingTarget {
    /** The workspace of both. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The connection. */
    readonly connectionId: string
}

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

/** What the agent can read: document and fact counts by visibility. */
export interface LensCounts {
    /** The audience of the lens. */
    readonly audience: Audience
    /** Documents by visibility. */
    readonly documents: { readonly public: number; readonly internal: number }
    /** Facts by visibility. */
    readonly facts: { readonly public: number; readonly internal: number; readonly restricted: number }
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

/** A file of an agent bundle. */
export type BundleFile = SyncFile

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
    readonly files: ReadonlyArray<BundleFile>
}

/** What one sync of an installation did. */
export interface SyncOutcome {
    /** The OpenClaw agent id. */
    readonly agentId: string
    /** The context version the files were built from. */
    readonly contextVersion: number | null
    /** False when the copy was already current and only the check time moved. */
    readonly changed: boolean
    /** Files created or rewritten. */
    readonly written: number
    /** Managed files removed. */
    readonly removed: number
    /** True when openclaw.json was rewritten. */
    readonly registered: boolean
    /** How many files the bundle has. */
    readonly files: number
    /** The hash over every file. */
    readonly contentHash: string
}

/** Which copy of the OpenClaw agents to rebuild. */
export interface SyncRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The one installation; the whole workspace when null. */
    readonly installationId: string | null
    /** Also sync an installation that is not on OpenClaw yet. */
    readonly force: boolean
}

/** The part of the sync record the next sync compares with. */
export interface SyncState {
    /** The hash over the files last written, or null. */
    readonly contentHash: string | null
    /** ok or error. */
    readonly status: string
}

/** A sync record, or null when the installation was never synced. */
export type OptionalSyncState = SyncState | null

/** What the sync record keeps of one successful sync. */
export interface SyncRecord {
    /** The workspace. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
    /** The OpenClaw agent id. */
    readonly agentId: string
    /** The context version, or null. */
    readonly contextVersion: number | null
    /** The hash over every file. */
    readonly contentHash: string
    /** Size and hash of each file, as JSON text. */
    readonly filesJson: string
    /** True when the files were rewritten (the synced time moves too). */
    readonly rewritten: boolean
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

/** The language the bundle files are written in. */
export type BundleLocale = Locale

/** The values that fill the `{{name}}` placeholders of a message. */
export type TextParams = Readonly<Record<string, string | number>>

/** Looks a message up in the bundle language. */
export type TextOf = (key: string, params?: TextParams) => string

/** One purpose or several. */
export type PurposeSelector = Purpose | ReadonlyArray<Purpose>

/** What waiting for a generation ended with. */
export type PollVerdict =
    | { readonly kind: "done"; readonly progress: GenerationProgress }
    | { readonly kind: "failed" }
    | { readonly kind: "timeout" }

/** What the run of a turn on the gateway produced: the text and its cost, or the reason there is none. */
export interface TurnAttempt {
    /** The text, or null when the run failed. */
    readonly text: string | null
    /** The usage the run reported. */
    readonly usage: GenerationUsage | null
    /** The marks of the run. */
    readonly timings: Readonly<Record<string, number>>
    /** Why there is no text; an empty text when there is one. */
    readonly reason: string
}

/** What a sync job works on. */
export type SyncScope =
    | {
          readonly kind: "installation"
          readonly workspaceId: string
          readonly installationId: string
          readonly force: boolean
      }
    | { readonly kind: "workspace"; readonly workspaceId: string }
    | { readonly kind: "all" }

/** A sync scope, or null when the payload names an installation without its workspace. */
export type OptionalSyncScope = SyncScope | null

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
    /** The authority and escalation rules. */
    readonly rules: ReadonlyArray<BaseRuleText>
    /** The applied context, or null. */
    readonly version: OptionalContextVersionText
    /** The standing memory of the brain, or an empty text. */
    readonly memory: string
    /** The titles and full text of the knowledge sources. */
    readonly sources: ReadonlyArray<{ readonly title: string; readonly content: string }>
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

/** The applied context as text, or null when none is applied. */
export type OptionalContextVersionText = { readonly version: number; readonly text: string } | null

/** The files of one agent workspace. */
export type SyncFileList = ReadonlyArray<BundleFile>

/** One tool of the bridge as AGENTS.md lists it. */
export interface ToolListing {
    /** The tool name. */
    readonly name: string
    /** What it does. */
    readonly description: string
    /** The arguments and their types. */
    readonly args: Readonly<Record<string, string>>
}

/** Anything that belongs to a module: an agent, an installation. */
export interface ModuleRef {
    /** The module key. */
    readonly module: string
}

/** An id, or null when there is none. */
export type OptionalId = string | null
