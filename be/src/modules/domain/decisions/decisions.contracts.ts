import type { RuleMode } from "@modules/domain/authority-rules"
import type { Locale } from "@modules/platform/i18n"
import type {
    Proposal,
    ProposalFieldValue,
    ReasonCode,
    SubjectType,
    WorkItem,
    EvidenceState,
} from "@modules/domain/work-items"

export type {
    DecidedPath,
    EvidenceState,
    OptionalWorkItem,
    Proposal,
    ProposalCandidate,
    ProposalFieldValue,
    ReasonCode,
    SubjectType,
    WorkItem,
    WorkStatus,
} from "@modules/domain/work-items"

/** What a decision outcome was. */
export type DecisionOutcome = "auto_done" | "approved" | "edited" | "rejected"

/** Who decides: a policy, the owner or a staff member. */
export type DeciderKind = "policy" | "owner" | "staff"

/** What a person may change before approving. */
export interface WorkEdits {
    /** A new draft. */
    readonly draft?: string
    /** A new amount, VND. */
    readonly amount_vnd?: number | null
    /** Changed fields. */
    readonly fields?: Readonly<Record<string, ProposalFieldValue>> | undefined
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
    /** The member (the seat) that decided; the decision log names it next to the display name. */
    readonly memberId?: string
}

/** The turn that asked for a piece of work: set by the agent-turn settler, read only by the action graph. */
export interface WorkOrigin {
    /** The turn whose proposal carried the action. */
    readonly turnId: string
    /** The wake that turn answered. */
    readonly wakeId: string
}

/** Everything `runWork` takes. */
export interface WorkSpec {
    /** The action key. */
    readonly action: string
    /** The kind of record. */
    readonly subject_type: SubjectType
    /** The id of the record. */
    readonly subject_id?: string | null | undefined
    /** The customer. */
    readonly lead_id?: string | null | undefined
    /** The input that started it. */
    readonly inbound_event_id?: string | null
    /** The item that asked for it. */
    readonly parent_id?: string | null
    /** The idempotency key, unique per workspace. */
    readonly dedupeKey: string
    /** Initial proposal data. */
    readonly seed?: Partial<Proposal>
    /** Insert only; `runQueued` performs it later. */
    readonly queue?: boolean | undefined
    /** Use `seed` as the proposal as-is: no prepare step, no model call. */
    readonly preset?: boolean | undefined
    /** Do not continue the chain after this item. */
    readonly noChain?: boolean | undefined
    /** Always ask a person, with this reason. */
    readonly forceAsk?: ReasonCode | undefined
    /** The command chain this item joins. */
    readonly chainId?: string | null
    /** Its depth in the chain. */
    readonly depth?: number
    /** The agent instance that handles it; omitted means the database resolves it. */
    readonly installationId?: string | null
    /** Called once, only when this call really inserted the row, before the gate runs. */
    readonly onInserted?: (row: WorkItem) => Promise<void>
    /** The agent turn that asked for it; the action graph records it with its decision. */
    readonly origin?: WorkOrigin | undefined
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
export interface ModuleCommand {
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
    readonly accepts: ReadonlyArray<ModuleCommand>
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
    /** The member who decided; absent for a policy decision. */
    readonly decided_by_member_id?: string | null
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

/** A module of the registry, or null when no such module exists. */
export type OptionalModuleEntry = ModuleEntry | null

/** An authority action of the registry, or null when no such action exists. */
export type OptionalActionEntry = ActionEntry | null

/** A performer, or null when the action has none. */
export type OptionalWorkPerformer = WorkPerformer | null

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

export type { RuleMode }
export type { Authority } from "@modules/domain/authority"
export type { AuthorityRule, GateVerdict, OptionalAuthorityRule } from "@modules/domain/authority-rules"
export type { OptionalAgentIdentity } from "@modules/domain/messages"
export type { ResponsibilityRecord, ResponsibilityStatus } from "@modules/domain/responsibilities"
