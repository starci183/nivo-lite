import type {
    CommandResult,
    DecidedPath,
    DeciderKind,
    DecisionOutcome,
    GateVerdict,
    OptionalAuthorityRule,
    SendCommandInput,
    SubjectType,
    WorkItem,
    WorkContext,
    ModuleCommand,
    ProposalCandidate,
    ProposalFieldValue,
    Proposal,
    ReasonCode,
    WorkSpec,
} from "./decisions.contracts"

/** How far a connection lets an agent act: read only, ask a person first, or act alone. */
export type OutboundAccess = "read" | "ask" | "auto"

/** A proposal after a person's edits, and whether the edits changed anything. */
export interface MergedProposal {
    /** The proposal with the edits applied. */
    readonly proposal: Proposal
    /** True when the person changed the draft, the amount or a field. */
    readonly changed: boolean
}

/** A command payload split into the address of the work item and the fields of its proposal. */
export interface SplitPayload {
    /** The kind of record; the receiver's default when the payload names none. */
    readonly subjectType: string
    /** The record, or null. */
    readonly subjectId: string | null
    /** The customer, or null. */
    readonly leadId: string | null
    /** Every other payload key. */
    readonly fields: Readonly<Record<string, ProposalFieldValue>>
}

/** Options of one pass of the gate over an item. */
export interface ProcessOptions {
    /** Use the stored proposal as it is: no prepare step. */
    readonly preset?: boolean | undefined
    /** Do not continue the chain. */
    readonly noChain?: boolean | undefined
    /** Always ask a person, with this reason. */
    readonly forceAsk?: ReasonCode | undefined
}

/** Who decided an item: a policy, the owner or a staff member. */
export interface Finisher {
    /** The display name. */
    readonly name: string
    /** Policy, owner or staff. */
    readonly kind: DeciderKind
    /** The member who decided; absent for the policy. */
    readonly memberId?: string
}

/** Who finished an item and how it was decided. */
export interface FinishPlan {
    /** By policy alone or by a person. */
    readonly path: DecidedPath
    /** The decider; NIVO itself for the automatic path. */
    readonly by: Finisher
    /** The outcome to log. */
    readonly outcome: Exclude<DecisionOutcome, "rejected">
    /** A note from the person. */
    readonly note?: string | null
    /** The proposal before the person's edits. */
    readonly before?: Proposal
}

/** Which instance of a multi-instance module handles a command, and how it was chosen. */
export interface InstanceChoice {
    /** The installation id. */
    readonly id: string
    /** The rule that chose it. */
    readonly via: string
    /** Its name, when it has one. */
    readonly name: string | null
}

/** An instance choice, or null when the receiver has one instance or none could be chosen. */
export type OptionalInstanceChoice = InstanceChoice | null

/** The sender of a command as the Office line names it. */
export interface CommandSender {
    /** The name shown in the mirror line. */
    readonly label: string
}

/** A sender, or null when the sender id names nobody. */
export type OptionalCommandSender = CommandSender | null

/** A command that passed every check and is ready to become a work item. */
export interface PlannedCommand {
    /** Marks the accepted case. */
    readonly ok: true
    /** What `runWork` takes; its `onInserted` hook writes the Office mirror and the evidence line. */
    readonly spec: WorkSpec
    /** The depth the item gets in its chain. */
    readonly depth: number
    /** True once the item this plan describes was really inserted by this call. */
    readonly inserted: () => boolean
}

/** A command the bus refused. */
export type CommandRefused = Extract<CommandResult, { readonly ok: false }>

/** The planner's answer: a plan to run, or a refusal. */
export type CommandPlan = PlannedCommand | CommandRefused

/** What the chain tells the receipt pipeline about a reconciled payment. */
export interface PaymentReceiptRequest {
    /** The transaction, when the item is about one. */
    readonly transactionId: string | null
    /** The invoice the payment settled, when it is known. */
    readonly invoiceId: string | null
}

/** Where a command sits in its chain: the chain it joins (null for a new one) and the depth its item gets. */
export interface ChainPosition {
    /** The chain, or null when the item starts its own. */
    readonly chainId: string | null
    /** Hops from the root of the chain. */
    readonly depth: number
}

/** Everything the planner has found out about an accepted command, before it becomes a work spec. */
export interface AcceptedCommandParts {
    /** Who and where the call acts. */
    readonly ctx: WorkContext
    /** The command as sent. */
    readonly input: SendCommandInput
    /** The receiver's definition of the command. */
    readonly accepted: ModuleCommand
    /** The sender's name for the Office line. */
    readonly sender: string
    /** The address and the fields of the payload. */
    readonly address: SplitPayload
    /** The kind of record the item is about, checked. */
    readonly subjectType: SubjectType
    /** Where the item sits in its chain. */
    readonly position: ChainPosition
    /** The idempotency key. */
    readonly dedupeKey: string
    /** The receiving instance, when one was chosen. */
    readonly instance: OptionalInstanceChoice
}

/** What the gate decided and the rule it read. */
export interface Judgement {
    /** The verdict, after a forced ask and the agent access check. */
    readonly verdict: GateVerdict
    /** The owner's rule for the action, with the operating mode applied. */
    readonly rule: OptionalAuthorityRule
}

/** A person's decision on a waiting item. */
export type ResumeDecision = "approved" | "rejected"

/** What an order input carries into Sales. */
export interface OrderStart {
    /** What was ordered. */
    readonly items: string
    /** The money, VND. */
    readonly amount_vnd: number | null
    /** The customer, when known. */
    readonly lead_id?: string | null
}

/** What inserting a work spec answered. */
export interface IntakeResult {
    /** The new item, or the existing one when the dedupe key was already used. */
    readonly item: WorkItem
    /** True when this call really inserted the row. */
    readonly created: boolean
}

/** Free text, or none. */
export type OptionalText = string | null

/** The proposal data an input starts a work item with. */
export interface ProposalSeed {
    /** One sentence for the owner. */
    readonly summary?: string
    /** The text to send. */
    readonly draft?: string
    /** The money involved, VND. */
    readonly amount_vnd?: number | null
    /** The structured fields. */
    readonly fields?: Readonly<Record<string, ProposalFieldValue>>
    /** How sure the agent is, 0..1. */
    readonly confidence?: number
    /** Whether the outcome is clear. */
    readonly outcome?: "clear" | "unclear"
    /** The invoices a payment may settle. */
    readonly candidates?: ReadonlyArray<ProposalCandidate>
}

/** The data a published decision carries. */
export interface DecisionPayload {
    /** Any value the decision carries (work item, action, department, outcome, decider, lead, summary). */
    readonly [name: string]: unknown
}
