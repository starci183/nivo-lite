import type { Locale } from "@modules/platform/i18n"

/** What a rule of the owner's authority says about an action: run alone, ask a person, or never. */
export type RuleMode = "auto" | "ask" | "never"

/** Why the gate decided what it decided. */
export type ReasonCode = "routine" | "missing_data" | "over_authority" | "unclear_outcome" | "not_allowed"

/** Where a work item stands. */
export type WorkStatus = "queued" | "done" | "waiting_decision" | "rejected" | "failed"

/** How much evidence backs the result of a work item. */
export type EvidenceState = "pending" | "captured" | "reviewed" | "verified" | "customer_confirmed"

/** Whether the input was real or simulated. */
export type Origin = "live" | "simulated"

/** How the item was decided: by policy alone or by a person. */
export type DecidedPath = "auto" | "human"

/** What a decision outcome was. */
export type DecisionOutcome = "auto_done" | "approved" | "edited" | "rejected"

/** Who decides: a policy, the owner or a staff member. */
export type DeciderKind = "policy" | "owner" | "staff"

/** The value of one field of a proposal. */
export type ProposalFieldValue = string | number | null

/** One invoice a payment may settle. */
export interface ProposalCandidate {
    /** The invoice id. */
    readonly id: string
    /** The line the owner reads. */
    readonly label: string
    /** The amount of the invoice, VND. */
    readonly amount_vnd: number
}

/** What an agent proposes to do: the summary, an optional draft and the structured fields the gate and the performer read. */
export interface Proposal {
    /** One sentence for the owner. */
    readonly summary: string
    /** The text to send, when the action sends one. */
    readonly draft?: string
    /** The money involved, VND. */
    readonly amount_vnd?: number | null
    /** The structured fields of the proposal. */
    readonly fields: Readonly<Record<string, ProposalFieldValue>>
    /** How sure the agent is, 0..1. */
    readonly confidence?: number
    /** Whether the outcome is clear. */
    readonly outcome?: "clear" | "unclear"
    /** The invoices a payment may settle. */
    readonly candidates?: ReadonlyArray<ProposalCandidate>
}

/** The kind of record a work item is about. */
export type SubjectType =
    "lead" | "order" | "invoice" | "transaction" | "conversation" | "inbound" | "purchase_order" | "stock"

/** What a performer reported it did. */
export interface WorkResult {
    /** One sentence for the log. */
    readonly summary: string
    /** Where the owner can see it. */
    readonly href?: string
}

/** One work item as the decisions capability reads and writes it. */
export interface WorkItem {
    /** The id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The module that performs it. */
    readonly department: string
    /** The action key. */
    readonly action: string
    /** The kind of record it is about. */
    readonly subject_type: SubjectType
    /** The id of that record. */
    readonly subject_id: string | null
    /** The customer it is about. */
    readonly lead_id: string | null
    /** The input that started it. */
    readonly inbound_event_id: string | null
    /** The item that asked for it. */
    readonly parent_id: string | null
    /** The root of its command chain. */
    readonly chain_id: string | null
    /** Hops from the root. */
    readonly depth: number
    /** Where it stands. */
    readonly status: WorkStatus
    /** How it was decided. */
    readonly decided_path: DecidedPath | null
    /** Why the gate asked. */
    readonly reason: ReasonCode | null
    /** Every reason, the first one is `reason`. */
    readonly reasons: ReadonlyArray<string>
    /** Required fields still missing. */
    readonly missing_fields: ReadonlyArray<string>
    /** What the agent proposes. */
    readonly proposal: Proposal
    /** What was done. */
    readonly result: WorkResult | null
    /** The failure, when it failed. */
    readonly error: string | null
    /** How much evidence backs the result. */
    readonly evidence_state: EvidenceState
    /** The staff member it is assigned to. */
    readonly assigned_staff_id: string | null
    /** The legacy approval execution. */
    readonly execution_id: string | null
    /** Real or simulated. */
    readonly origin: Origin
    /** When it was created. */
    readonly created_at: string
    /** When it last changed. */
    readonly updated_at: string
    /** When it finished. */
    readonly completed_at: string | null
    /** The agent instance that handles it. */
    readonly installation_id: string | null
}

/** The rule of the owner's authority for one action. */
export interface AuthorityRule {
    /** The id. */
    readonly id: string
    /** The module. */
    readonly department: string
    /** The action key. */
    readonly action: string
    /** The mode. */
    readonly mode: RuleMode
    /** The action runs alone strictly below this amount, VND; null means no limit. */
    readonly limit_vnd: number | null
    /** Fields that must be present. */
    readonly required_fields: ReadonlyArray<string>
}

/** The owner's goals and house rules that the prompts carry. */
export interface Authority {
    /** The business policies. */
    readonly policies: string
    /** How replies are written. */
    readonly reply_style: string
    /** The brand voice. */
    readonly brand_voice: string
    /** What the agent must always ask about first. */
    readonly limits_note: string
}

/** What the gate answers. */
export interface GateVerdict {
    /** Run alone or ask. */
    readonly verdict: "auto" | "ask"
    /** The first reason. */
    readonly reason: ReasonCode
    /** Every reason. */
    readonly reasons: ReadonlyArray<ReasonCode>
    /** Required fields still missing. */
    readonly missing: ReadonlyArray<string>
}

/** What the gate reads. */
export interface GateInput {
    /** The action key. */
    readonly action: string
    /** The rule of the owner for the action, or null when there is none. */
    readonly rule: AuthorityRule | null
    /** The cap the registry puts on the action: it can never run alone above it. */
    readonly maxMode: RuleMode | null
    /** What the agent proposes. */
    readonly proposal: Proposal
    /** True when a person approved this very item. */
    readonly humanApproved?: boolean
}

/** What a person may change before approving. */
export interface WorkEdits {
    /** A new draft. */
    readonly draft?: string
    /** A new amount, VND. */
    readonly amount_vnd?: number | null
    /** Changed fields. */
    readonly fields?: Readonly<Record<string, ProposalFieldValue>>
    /** The invoice the owner chose among the candidates. */
    readonly candidateId?: string
}

/** Who and in which workspace a call acts. The workspace is never taken from a request body. */
export interface WorkContext {
    /** The workspace. */
    readonly workspaceId: string
    /** The display name of the actor, for logs and the Office. */
    readonly actor: string
    /** The language of the generated text. */
    readonly locale: Locale
}

/** Who decides an item. */
export interface Decider {
    /** The display name. */
    readonly name: string
    /** Owner or staff. */
    readonly kind: "owner" | "staff"
}

/** Everything `runWork` takes. */
export interface WorkSpec {
    /** The action key. */
    readonly action: string
    /** The kind of record. */
    readonly subject_type: SubjectType
    /** The id of the record. */
    readonly subject_id?: string | null
    /** The customer. */
    readonly lead_id?: string | null
    /** The input that started it. */
    readonly inbound_event_id?: string | null
    /** The item that asked for it. */
    readonly parent_id?: string | null
    /** The idempotency key, unique per workspace. */
    readonly dedupeKey: string
    /** Real or simulated. */
    readonly origin: Origin
    /** Initial proposal data. */
    readonly seed?: Partial<Proposal>
    /** Insert only; `runQueued` performs it later. */
    readonly queue?: boolean
    /** Use `seed` as the proposal as-is: no prepare step, no model call. */
    readonly preset?: boolean
    /** Do not continue the chain after this item. */
    readonly noChain?: boolean
    /** Always ask a person, with this reason. */
    readonly forceAsk?: ReasonCode
    /** The command chain this item joins. */
    readonly chainId?: string | null
    /** Its depth in the chain. */
    readonly depth?: number
    /** The agent instance that handles it; omitted means the database resolves it. */
    readonly installationId?: string | null
    /** Called once, only when this call really inserted the row, before the gate runs. */
    readonly onInserted?: (row: WorkItem) => Promise<void>
}

/** What a performer prepares: the proposal and the patch of the item's address. */
export interface Prepared {
    /** The proposal the gate judges. */
    readonly proposal: Proposal
    /** Changes to the item's address. */
    readonly patch?: Partial<Pick<WorkItem, "subject_type" | "subject_id" | "lead_id">>
}

/** What a performer did. */
export interface Performed {
    /** One sentence for the log. */
    readonly summary: string
    /** How much evidence backs it. */
    readonly evidence: EvidenceState
    /** Where the owner can see it. */
    readonly href?: string
    /** The customer, when the performer found or created one. */
    readonly lead_id?: string | null
    /** Extra detail for the log. */
    readonly detail?: string | null
}

/**
 * The work of one action. A capability registers its performers with the `WorkPerformerRegistry`; the engine asks the registry for
 * the performer of an action, and an action without one only records the decision.
 */
export interface WorkPerformer {
    /** Builds the proposal of an item; may call the model once. */
    prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared>
    /** Does the work once the gate or a person allowed it. */
    perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed>
    /** Undoes what `prepare` set up when a person rejects the item. */
    onReject?(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<void>
}

/** A command a module accepts from other agents, as its definition declares it. */
export interface AcceptedCommand {
    /** The command key. */
    readonly command: string
    /** The action it becomes on the receiver. */
    readonly action: string
    /** The kind of record it is about. */
    readonly subjectType: string
    /** Payload keys it requires. */
    readonly requiredFields: ReadonlyArray<string>
    /** What it does, in both languages. */
    readonly description: Bilingual
}

/** The part of a module definition the engine reads. */
export interface ModuleEntry {
    /** The module key. */
    readonly key: string
    /** The audience the module talks to. */
    readonly audience: "customer" | "internal"
    /** True when a workspace may install several agents of the type. */
    readonly multiInstance: boolean
    /** The full name in both languages. */
    readonly name: Bilingual
    /** The commands the module accepts. */
    readonly accepts: ReadonlyArray<AcceptedCommand>
}

/** The part of an authority action the engine reads. */
export interface ActionEntry {
    /** The action key. */
    readonly action: string
    /** The module that performs it. */
    readonly moduleKey: string
    /** The cap on its mode, or null. */
    readonly maxMode: RuleMode | null
    /** The actions queued after it is done. */
    readonly next: ReadonlyArray<string>
    /** The label in both languages. */
    readonly label: Bilingual
}

/** The refusal reasons of the command bus. */
export type CommandRefusal =
    "unknown_module" | "unknown_command" | "unknown_sender" | "missing_fields" | "too_deep" | "cycle"

/** What the command bus takes. */
export interface SendCommandInput {
    /** "owner", "inbound", a module key or an agent id. */
    readonly from: string
    /** The receiving module. */
    readonly to: string
    /** The command key of the receiver. */
    readonly command: string
    /** The payload: `subject_type`, `subject_id`, `lead_id` address the item, the rest become proposal fields. */
    readonly payload: Readonly<Record<string, unknown>>
    /** The chain the command joins. */
    readonly chainId?: string | null
    /** The item that asked. */
    readonly parentId?: string | null
    /** Why, in one line. */
    readonly reason: string
    /** The receiving instance, when the sender knows it. */
    readonly installationId?: string | null
    /** The idempotency key. */
    readonly dedupeKey?: string
    /** Real or simulated. */
    readonly origin?: Origin
    /** The input that started the chain. */
    readonly inboundEventId?: string | null
    /** Initial proposal data. */
    readonly seed?: Partial<Proposal>
    /** Insert only. */
    readonly queue?: boolean
    /** Use the seed as the proposal. */
    readonly preset?: boolean
    /** Do not continue the chain. */
    readonly noChain?: boolean
    /** Always ask, with this reason. */
    readonly forceAsk?: ReasonCode
}

/** What the command bus answers. */
export type CommandResult =
    | {
          readonly ok: true
          readonly item: WorkItem
          readonly created: boolean
          readonly chainId: string | null
          readonly depth: number
      }
    | {
          readonly ok: false
          readonly refused: CommandRefusal
          readonly detail: string
          readonly missing?: ReadonlyArray<string>
      }

/** One line of the Office thread. */
export interface OfficeLineInput {
    /** The text. */
    readonly body: string
    /** The customer it is about. */
    readonly lead_id: string | null
    /** The work item it mirrors. */
    readonly work_item_id: string | null
    /** The department whose agent speaks. */
    readonly dept?: string
    /** True for a command mirror, always a system line. */
    readonly command?: boolean
    /** The instance whose agent speaks. */
    readonly installation_id?: string | null
}

/** The kind of input a channel delivered. */
export type InboundKind = "message" | "lead" | "order" | "payment"

/** Where an input stands. */
export type InboundStatus = "received" | "processed" | "needs_decision" | "failed"

/** One input a channel delivered (a customer message, a lead, an order or a payment), as the engine reads it. */
export interface InboundEventRecord {
    /** The id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The channel it came through. */
    readonly channel: string
    /** What kind of input it is. */
    readonly kind: InboundKind
    /** Real or simulated. */
    readonly origin: Origin
    /** The sender's name. */
    readonly sender_name: string | null
    /** The sender's phone or email. */
    readonly sender_contact: string | null
    /** The text. */
    readonly body: string
    /** The money in it, VND. */
    readonly amount_vnd: number | null
    /** The external reference (bank reference, order number). */
    readonly external_ref: string | null
    /** The idempotency key. */
    readonly dedupe_key: string
    /** How many times the channel redelivered it. */
    readonly duplicate_count: number
    /** When it was last redelivered. */
    readonly last_duplicate_at: string | null
    /** The customer it belongs to. */
    readonly lead_id: string | null
    /** Where it stands. */
    readonly status: InboundStatus
    /** When it arrived. */
    readonly created_at: string
    /** The channel's own event id. */
    readonly event_id: string | null
}

/** Where a responsibility stands. */
export type ResponsibilityStatus = "open" | "waiting_approval" | "done"

/** Who owns a responsibility. */
export type ResponsibilityOwnerKind = "human" | "agent"

/** One thing somebody (a person or an agent) owes a customer. */
export interface ResponsibilityRecord {
    /** The id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The customer. */
    readonly lead_id: string
    /** What it is. */
    readonly title: string
    /** Person or agent. */
    readonly owner_kind: ResponsibilityOwnerKind
    /** The owning agent, when an agent owns it. */
    readonly owner_agent_id: string | null
    /** The display name of the owner. */
    readonly owner_name: string
    /** The next step. */
    readonly next_action: string
    /** When it is due. */
    readonly due_at: string | null
    /** Where it stands. */
    readonly status: ResponsibilityStatus
    /** When it was created. */
    readonly created_at: string
}

/** One line of the evidence log as a caller writes it; the workspace comes from the context. */
export interface EvidenceEntry {
    /** The customer it is about. */
    readonly lead_id?: string | null
    /** The work item it belongs to. */
    readonly work_item_id?: string | null
    /** A dotted name such as `core.duplicate_blocked`. */
    readonly kind: string
    /** Who did it. */
    readonly actor: string
    /** One short sentence. */
    readonly summary: string
    /** The raw text that backs it. */
    readonly evidence?: string | null
}

/** One line of the decision log as a caller writes it; the workspace comes from the context. */
export interface DecisionEntry {
    /** The work item decided. */
    readonly work_item_id: string | null
    /** The customer. */
    readonly lead_id: string | null
    /** The module. */
    readonly department: string
    /** The action key. */
    readonly action: string
    /** Who decided: a person's name or NIVO. */
    readonly decided_by: string
    /** Policy, owner or staff. */
    readonly decider_kind: DeciderKind
    /** What was decided. */
    readonly outcome: DecisionOutcome
    /** Why the gate asked. */
    readonly reason?: ReasonCode | null
    /** A note from the decider. */
    readonly note?: string | null
    /** The proposal before the decision, JSON-serialisable. */
    readonly before?: Proposal | null
    /** The proposal after the decision, JSON-serialisable. */
    readonly after?: Proposal | null
}

/** The owner's authority, or null before the workspace has one. */
export type OptionalAuthority = Authority | null

/** The rule of one action, or null when the owner granted none. */
export type OptionalAuthorityRule = AuthorityRule | null

/** A module of the registry, or null when no such module exists. */
export type OptionalModuleEntry = ModuleEntry | null

/** An authority action of the registry, or null when no such action exists. */
export type OptionalActionEntry = ActionEntry | null

/** A work item, or null when none matches. */
export type OptionalWorkItem = WorkItem | null

/** A performer, or null when the action has none. */
export type OptionalWorkPerformer = WorkPerformer | null

/** The agent that speaks for a department in the Office. */
export interface AgentIdentity {
    /** The agent id. */
    readonly id: string
    /** The display name. */
    readonly name: string
}

/** An agent identity, or null when the department has no agent. */
export type OptionalAgentIdentity = AgentIdentity | null

/** A text in both languages. */
export interface Bilingual {
    /** The Vietnamese text. */
    readonly vi: string
    /** The English text. */
    readonly en: string
}

/** Somebody who acts on an item, by name. */
export interface ActorRef {
    /** The display name. */
    readonly name: string
}

/** Whoever performs or rejects an item: a person who decided, or any named actor. */
export type PerformedBy = Decider | ActorRef
