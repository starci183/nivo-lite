import type { PipelineConfig, PipelineRow } from "@modules/domain/automation-pipelines"
import type { RunResult } from "@modules/domain/automation-runs"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import type { ShopWithHours } from "./automations.contracts"

/** A lead id, or none for a line that is not about a customer. */
export type OptionalLead = string | null

/** A follow-up task for a person. */
export interface FollowUp {
    /** The lead it is about. */
    readonly leadId: string
    /** The title: also how an open duplicate is recognised. */
    readonly title: string
    /** The person who owns it. */
    readonly ownerName: string
    /** What to do. */
    readonly nextAction: string
    /** When it is due, ISO 8601. */
    readonly dueAt: string
}

/** A line in the evidence log. */
export interface AutomationEvidenceEntry {
    /** The lead it is about. */
    readonly leadId?: string
    /** The kind, for example `automation.owner_notified`. */
    readonly kind: string
    /** Who did it. */
    readonly actor: string
    /** What happened. */
    readonly summary: string
    /** The proof. */
    readonly evidence?: string | undefined
}

/** The Office of a workspace, which owns its line, its tasks and its evidence log: the automations write to them only through it. */
export interface AutomationOffice {
    /** Posts a line from the system in Office, optionally about a lead. */
    postLine(workspaceId: string, body: string, leadId: OptionalLead): Promise<void>
    /** Writes one line to the evidence log. */
    logEvidence(workspaceId: string, entry: AutomationEvidenceEntry): Promise<void>
    /** Opens a follow-up task unless one with the same title is open; answers true when it opened one. */
    openFollowUp(workspaceId: string, task: FollowUp): Promise<boolean>
}

/** A customer known by name only, to be followed up. */
export interface AutomationNewLead {
    /** The name the customer goes by. */
    readonly contactName: string
    /** The channel it came from. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The stage to start in. */
    readonly stage: string
}

/** The records the automations create or change in other capabilities. */
export interface AutomationRecords {
    /** Creates an open lead for a customer known by name only and answers its id. */
    createLead(workspaceId: string, lead: AutomationNewLead): Promise<string>
    /** Attaches a lead to a contract that had none. */
    attachContractLead(workspaceId: string, contractId: string, leadId: string): Promise<void>
}

/** What a message put through the gate is about. */
export interface GateSubject {
    /** A lead, or the conversation of a reply. */
    readonly type: "lead" | "conversation"
    /** Its id. */
    readonly id: string | null
}

/** The fields the gate shows the owner, by name. */
export interface GateFields {
    /** The value of a field. */
    readonly [name: string]: string
}

/** A customer message put through the authority gate. */
export interface GateSubmission {
    /** The workspace. */
    readonly workspaceId: string
    /** Who acts in the log, for example the automation's name. */
    readonly actor: string
    /** The authority action: `send_care`, `send_follow_up`, `reply_customer`... */
    readonly action: string
    /** What the work is about. */
    readonly subject: GateSubject
    /** The lead, when there is one. */
    readonly leadId: string | null
    /** Unique per occurrence: the same key never sends twice. */
    readonly dedupeKey: string
    /** What the work does, in a line. */
    readonly summary: string
    /** The finished text; no model call happens at the gate. */
    readonly draft: string
    /** The fields the gate shows the owner. */
    readonly fields: GateFields
    /** True when the owner must decide whatever the rule says. */
    readonly forceAsk: boolean
    /** True when the owner accepted "send by itself": a message that waits only for its rule is approved on their behalf. */
    readonly autoApprove: boolean
}

/** What the gate did with a message. */
export interface GateOutcome {
    /** The work item. */
    readonly itemId: string
    /** `sent` left by itself, `waiting` waits for the owner, `rejected` was refused, `failed` could not be sent. */
    readonly state: "sent" | "waiting" | "rejected" | "failed"
    /** What was done, in a line. */
    readonly summary: string | null
    /** Why it waits. */
    readonly reason: string | null
    /** Why it failed. */
    readonly error: string | null
    /** True when the owner's "send by itself" approved it. */
    readonly autoApproved: boolean
}

/** The authority gate of a workspace: the one way a message to a customer leaves. */
export interface AutomationGate {
    /** Puts the message through the owner's rule for its action. */
    submit(submission: GateSubmission): Promise<GateOutcome>
}

/** One request to write text. */
export interface AutomationTextRequest {
    /** The workspace the usage is billed to. */
    readonly workspaceId: string
    /** What the text is for. */
    readonly purpose: "personalize" | "per_case" | "classify"
    /** The instructions. */
    readonly system: string
    /** The input. */
    readonly prompt: string
}

/** Text a model wrote, or none when it could not answer. */
export type GeneratedText = string | null

/** The one place automations ask a model to write text. */
export interface AutomationText {
    /** Writes the text, or answers none when the model is unavailable. */
    generate(request: AutomationTextRequest): Promise<GeneratedText>
}

/** The owner's own chat. */
export interface AutomationOwnerChat {
    /** Sends a text to the owner's chat; true when one was reached. */
    sendToOwner(workspaceId: string, text: string): Promise<boolean>
}

/** A Google account of a workspace. */
export interface GoogleAccount {
    /** The connection id. */
    readonly id: string
    /** The email of the account. */
    readonly email: string
    /** The state of the connection. */
    readonly status: string
}

/** What an executor gets. */
export interface ExecutorContext {
    /** The workspace. */
    readonly workspaceId: string
    /** The pipeline. */
    readonly pipeline: PipelineRow
    /** The template. */
    readonly def: TemplateDefinition
    /** The resolved settings. */
    readonly config: PipelineConfig
    /** The approved message template (the standard wording when the owner never saved one). */
    readonly body: string
    /** The shop. */
    readonly shop: ShopWithHours
}

/** What a trigger carried, by name. */
export interface ExecutorPayload {
    /** Any value the trigger carried. */
    readonly [name: string]: unknown
}

/** Does ONE thing for a trigger and reports steps and evidence. */
export type Executor = (context: ExecutorContext, payload: ExecutorPayload) => Promise<RunResult>

/** Executors by template key. */
export interface ExecutorMap {
    /** The executor of a template. */
    readonly [templateKey: string]: Executor
}

/** An executor, or none. */
export type OptionalExecutor = Executor | undefined

/** How many runs a scan started, or none when the template is not the scan's own. */
export type ScanOutcome = number | null

/** Starts a run of the pipeline being scanned. */
export type StartScanRun = (dedupe: string, triggerRef: string, payload: ExecutorPayload) => Promise<void>

/** A customer's reply to read for feedback after a review request. */
export interface FeedbackCheck {
    /** The review pipeline. */
    readonly context: ExecutorContext
    /** The run that asked for the review. */
    readonly runId: string
    /** What that run was executed from. */
    readonly runPayload: ExecutorPayload
    /** What the customer wrote. */
    readonly feedback: string
    /** The customer. */
    readonly leadId: string
}

/** What a scan of one pipeline gets. */
export interface ScanContext extends ExecutorContext {
    /** The instant of the tick. */
    readonly now: Date
    /** The most runs a scan starts. */
    readonly batch: number
    /** Starts a run of the pipeline being scanned. */
    readonly trigger: StartScanRun
}

/** What another capability plugs into the automations engine: executors, scans, a tick, a hook before a switch-on and the accounts a template can write with. */
export interface AutomationExtension {
    /** The executors by template key. */
    readonly executors?: ExecutorMap
    /** Scans one pipeline of a template it owns and answers how many runs it started; none for a template it does not own. */
    scan?(context: ScanContext): Promise<ScanOutcome>
    /** Runs once a tick, apart from any pipeline (loyalty, booking, shifts); answers the work it did. */
    tick?(now: Date): Promise<number>
    /** Prepares the config of a template at its first switch-on (a spreadsheet is created); answers the config to store. */
    prepareEnable?(
        workspaceId: string,
        userId: string,
        def: TemplateDefinition,
        config: PipelineConfig,
    ): Promise<PipelineConfig>
    /** The Google accounts a spreadsheet template can write with. */
    googleAccounts?(workspaceId: string): Promise<ReadonlyArray<GoogleAccount>>
}
