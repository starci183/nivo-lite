import type { Capability, LocalizedText, TemplateDefinition } from "@modules/domain/automation-templates"
import type { PipelineConfig, PipelineRow } from "@modules/domain/automation-pipelines"
import type { RunRow, RunStatus, RunStep } from "@modules/domain/automation-runs"

/** The shop an automation speaks for. */
export interface ShopContext {
    /** The name of the shop. */
    readonly shop: string
    /** The opening hours as `HH:MM - HH:MM`, or empty. */
    readonly hours: string
    /** The tone of voice the owner set. */
    readonly tone: string
}

/** A window of the day in minutes since midnight. */
export interface HoursRange {
    /** The opening minute. */
    readonly from: number
    /** The closing minute. */
    readonly to: number
}

/** The shop with its opening hours as numbers. */
export interface ShopWithHours extends ShopContext {
    /** The opening window, null when the information does not state one. */
    readonly hoursRange: HoursRange | null
}

/** What a message is written with. */
export interface MessageVariables {
    /** The value of a variable of a message, by name. */
    readonly [name: string]: string | undefined
}

/** Why a template cannot be switched on yet. */
export interface MissingRequirement {
    /** What kind of thing is missing. */
    readonly kind: "module" | "channel" | "connection" | "capability"
    /** The key of the missing thing. */
    readonly key: string
    /** The label of the missing thing, in both languages. */
    readonly label: LocalizedText
}

/** The trust ladder of one pipeline. */
export interface TrustView {
    /** Consecutive owner approvals without edits. */
    readonly streak: number
    /** True when "send by itself" is on offer. */
    readonly offered: boolean
    /** True when the owner accepted it. */
    readonly autoSend: boolean
}

/** What a message sent through the gate will do under the owner's current authority. */
export type GateMode = "auto" | "ask" | "never"

/** One template card as the screen shows it, assembled on the server. */
export interface AutomationCard {
    /** The template key. */
    readonly key: string
    /** The definition. */
    readonly def: TemplateDefinition
    /** The pipeline of this workspace, null before the first switch. */
    readonly pipelineId: string | null
    /** True when the owner switched it on. */
    readonly enabled: boolean
    /** True when the owner pressed "not for me". */
    readonly dismissed: boolean
    /** The settings, resolved and clamped. */
    readonly config: PipelineConfig
    /** The approved message template, null until the owner approved one. */
    readonly body: string | null
    /** How many times the body was saved. */
    readonly bodyVersion: number
    /** The context version the body was written from. */
    readonly basedOnContext: number | null
    /** The context version in force now. */
    readonly currentContext: number | null
    /** True when the shop information changed after the body was approved. */
    readonly bodyStale: boolean
    /** What happens to a customer message, null when the template sends none. */
    readonly gate: GateMode | null
    /** The requirements not met; empty means applicable. */
    readonly missing: ReadonlyArray<MissingRequirement>
    /** False for a capability-gated pack whose capability the shop lacks: the gallery hides it. */
    readonly proposed: boolean
    /** True when the definition exists but nothing runs yet. */
    readonly comingSoon: boolean
    /** When it last ran. */
    readonly lastRunAt: string | null
    /** How many runs the history holds. */
    readonly runCount: number
    /** The trust ladder. */
    readonly trust: TrustView
    /** For templates that write to Google: the state of the connection. */
    readonly google?: "ready" | "missing" | "lost" | "unavailable"
    /** For templates that write to Google: the spreadsheet link. */
    readonly sheetUrl?: string | null
}

/** One row of the run history as the screen shows it. */
export interface AutomationRunView {
    /** The run id. */
    readonly id: string
    /** The pipeline it belongs to. */
    readonly pipelineId: string
    /** The template key. */
    readonly templateKey: string
    /** How it stands. */
    readonly status: RunStatus
    /** What triggered it. */
    readonly triggerRef: string
    /** One line in plain words. */
    readonly summary: string
    /** The steps. */
    readonly steps: ReadonlyArray<Pick<RunStep, "label" | "status" | "detail">>
    /** Why it did this. */
    readonly evidence: string | null
    /** The error of a failed run. */
    readonly error: string | null
    /** When it started. */
    readonly createdAt: string
    /** When it ended. */
    readonly finishedAt: string | null
    /** The decision it waits for. */
    readonly workItemId: string | null
    /** The message that was or will be sent. */
    readonly message: string | null
}

/** Sample data for previews of a message. */
export interface PreviewSample {
    /** Sample values by variable name. */
    readonly variables: Readonly<Record<string, string>>
    /** The neutral words that fill a blank variable, by variable name. */
    readonly neutral: Readonly<Record<string, string>>
}

/** Everything the automations screen shows. */
export interface AutomationsOverview {
    /** One card per template. */
    readonly cards: ReadonlyArray<AutomationCard>
    /** The latest runs. */
    readonly runs: ReadonlyArray<AutomationRunView>
    /** The shop the previews speak for. */
    readonly shop: ShopContext
    /** The sample data of the previews. */
    readonly sample: PreviewSample
}

/** What a request may change on one pipeline; every field is optional. */
export interface PipelinePatch {
    /** Switch on or off. */
    readonly enabled?: boolean | undefined
    /** Hide or restore ("not for me"). */
    readonly dismissed?: boolean | undefined
    /** New setting values; keys that are not settings are ignored. */
    readonly values?: object | undefined
    /** The approved message template. */
    readonly body?: string | undefined
    /** The answer to "send by itself": true accepts, false declines. */
    readonly autoSend?: boolean | undefined
    /** The Google account a spreadsheet automation writes with. */
    readonly googleConnectionId?: string | undefined
}

/** A proposal for the wording of a message. */
export interface BodyProposal {
    /** The proposed template. */
    readonly body: string
    /** False when the standard wording is returned because the model could not write one. */
    readonly generated: boolean
    /** The context version the proposal is written from. */
    readonly contextVersion: number | null
}

/** A template worth proposing right after a module is installed. */
export interface AutomationSuggestion {
    /** The template key. */
    readonly key: string
    /** The name. */
    readonly name: LocalizedText
    /** Why. */
    readonly reason: LocalizedText
}

/** The raw rows the overview is assembled from (the `automations_data` function answers them in one call). */
export interface OverviewRows {
    /** The installed modules with the context version each runs on. */
    readonly installations: ReadonlyArray<InstallationRow>
    /** The pipelines of the workspace. */
    readonly pipelines: ReadonlyArray<PipelineRow>
    /** The latest runs. */
    readonly runs: ReadonlyArray<RunRow>
    /** The Google connection, if any. */
    readonly google: {
        readonly status: string
        readonly last_error: string | null
        readonly public_meta: Record<string, string> | null
    } | null
    /** The knowledge sources (title and content). */
    readonly knowledge: ReadonlyArray<{ readonly title: string; readonly content: string }>
    /** How many invoices carry a due date. */
    readonly due_invoices: number
    /** The live connections. */
    readonly connections: ReadonlyArray<{ readonly provider: string; readonly status: string }>
    /** How many chat agents are active. */
    readonly chat_agents: number
    /** The name of the workspace. */
    readonly workspace_name: string | null
    /** The reply style and brand voice. */
    readonly authority: { readonly reply_style?: string; readonly brand_voice?: string } | null
    /** The owner's rules: department, action and mode. */
    readonly rules: ReadonlyArray<{ readonly department: string; readonly action: string; readonly mode: GateMode }>
    /** How many contracts exist. */
    readonly contracts: number
    /** How many orders were shipped. */
    readonly shipped_orders: number
}

/** A context snapshot of one module. */
export interface ContextSnapshot {
    /** The summary text. */
    readonly summary?: string
    /** The facts. */
    readonly facts?: ReadonlyArray<{ readonly text: string }>
    /** The gates with their evidence. */
    readonly gates?: Readonly<Record<string, { readonly evidence?: string }>>
}

/** One installed module with its active context. */
export interface InstallationRow {
    /** The module key. */
    readonly module_key: string
    /** The operating mode of the department. */
    readonly operating_mode: string | null
    /** The active context version. */
    readonly ctx: { readonly id: string; readonly version: number; readonly snapshot: ContextSnapshot } | null
}

/** The facts a template's requirements are checked against. */
export interface ShopFacts {
    /** The installed module keys. */
    readonly installed: ReadonlyArray<string>
    /** What the shop has. */
    readonly capabilities: ReadonlySet<Capability>
    /** True when a customer chat channel exists. */
    readonly hasChat: boolean
    /** The live connections. */
    readonly connections: ReadonlyArray<{ readonly provider: string; readonly status: string }>
}

/** The values that fill the `{{name}}` blanks of a catalog text. */
export interface TextParams {
    /** The value of a blank, by name. */
    readonly [name: string]: string | number
}

/** A lead a scan considers. */
export interface ScannedLead {
    /** The lead id. */
    readonly id: string
    /** The stage. */
    readonly stage: string
    /** When it was created, ISO 8601. */
    readonly createdAt: string
}

/** An invoice past its due date. */
export interface DebtInvoice {
    /** The invoice id. */
    readonly id: string
    /** The invoice number. */
    readonly invoiceNo: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** The customer. */
    readonly leadId: string | null
    /** When it was due, ISO 8601. */
    readonly dueAt: string
}

/** What a business event carries. */
export interface EventData {
    /** Any value the event carries. */
    readonly [name: string]: unknown
}

/** A business event to evaluate for the pipelines of its workspace. */
export interface BusinessEvent {
    /** The workspace. */
    readonly workspaceId: string
    /** The event name, for example `payment.received`. */
    readonly event: string
    /** What the event carries. */
    readonly data: EventData
    /** Unique per occurrence: the same key never starts a run twice. */
    readonly dedupe: string
}

/** A run started from code for one workspace. */
export interface FireTemplate {
    /** The workspace. */
    readonly workspaceId: string
    /** The template to run. */
    readonly templateKey: string
    /** Unique per occurrence. */
    readonly dedupe: string
    /** What the run is about. */
    readonly triggerRef: string
    /** What the run is executed from. */
    readonly payload: EventData
}

/** What a tick did. */
export interface TickResult {
    /** How many pipelines were on. */
    readonly pipelines: number
    /** How many runs were executed or started. */
    readonly runs: number
}

/** One pipeline that is on, with its template and settings. */
export interface LoadedPipeline {
    /** The stored pipeline. */
    readonly pipeline: PipelineRow
    /** Its template. */
    readonly def: TemplateDefinition
    /** Its settings, resolved and clamped. */
    readonly config: PipelineConfig
}

/** A business event as a member reports it: the workspace comes from the request. */
export interface BusinessEventInput {
    /** The event name, for example `payment.received`. */
    readonly event: string
    /** What the event carries. */
    readonly data: object
    /** Unique per occurrence. */
    readonly dedupe: string
}

/** A lead another capability just created, as the `lead.created` event carries it. */
export interface CreatedLead {
    /** The lead. */
    readonly id: string
    /** The customer's name. */
    readonly contact_name: string
    /** The company. */
    readonly company: string
    /** The channel label. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The phone, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
}
