/** Why the gate decided what it decided. */
export type ReasonCode =
    "routine" | "missing_data" | "over_authority" | "unclear_outcome" | "not_allowed" | "branch_ask"

/** Where a work item stands. */
export type WorkStatus = "queued" | "done" | "waiting_decision" | "rejected" | "failed"

/** How much evidence backs the result of a work item. */
export type EvidenceState = "pending" | "captured" | "reviewed" | "verified" | "customer_confirmed"

/** How the item was decided: by policy alone or by a person. */
export type DecidedPath = "auto" | "human"

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

/** Durable execution choices supplied by a work producer, outside the editable proposal fields. */
export interface WorkExecutionOptions {
    /** Use the supplied proposal without preparing another one. */
    readonly preset?: boolean | undefined
    /** Finish this item without starting the next action. */
    readonly noChain?: boolean | undefined
    /** Ask for approval even when the authority rule permits automatic work. */
    readonly forceAsk?: ReasonCode | undefined
    /** The tag right of the sender already let this work in: with no rule stored it runs under the action's catalogue default; a stored rule still decides. */
    readonly tagGrant?: boolean | undefined
    /** The producer posts its own card in the team chat for this ask (the card of a stopped workflow): the engine says no line of its own. */
    readonly ownCard?: boolean | undefined
}

/** What an agent proposes to do: the summary, an optional draft and the structured fields the gate and the performer read. */
export interface Proposal {
    /** One sentence for the owner. */
    readonly summary: string
    /** The text to send, when the action sends one. */
    readonly draft?: string | undefined
    /** The money involved, VND. */
    readonly amount_vnd?: number | null | undefined
    /** The structured fields of the proposal. */
    readonly fields: Readonly<Record<string, ProposalFieldValue>>
    /** How sure the agent is, 0..1. */
    readonly confidence?: number
    /** Whether the outcome is clear. */
    readonly outcome?: "clear" | "unclear"
    /** The invoices a payment may settle. */
    readonly candidates?: ReadonlyArray<ProposalCandidate> | undefined
    /** The producer's execution choices, retained across a durable handoff and approval. */
    readonly execution?: WorkExecutionOptions | undefined
    /** What the road that opened the work knows, with where it came from. */
    readonly evidence?: ReadonlyArray<GraphEvidence> | undefined
}

/** The evidence key of an amount of money, until its plug-in owns the key. */
export const AMOUNT_EVIDENCE = "amount_vnd"

/** Who an entry of evidence came from: whoever the door saw. Plug-ins decide what an actor may do; the graph never reads this. */
export interface EvidenceActor {
    /** Member, agent or system. */
    readonly kind: string
    /** The id. */
    readonly id: string
    /** The role, when the actor has one. */
    readonly role: string | null
}

/**
 * One thing a turn knows, carried for the plug-in that reads it: the graph passes the list on and never looks inside. A new source adds an
 * entry and changes nothing else. A `null` value is a read that failed or was unclear.
 */
export interface GraphEvidence {
    /** What the entry is about. */
    readonly key: string
    /** The value, or null when it could not be read. */
    readonly value: string | number | boolean | null
    /** How far it can be trusted, in the words of the plug-in that reads it. */
    readonly kind: string
    /** The road it came by. A trigger of the graph may choose which roads count. */
    readonly via: string
    /** Who it came from, when the door knows. */
    readonly actor?: EvidenceActor | undefined
}

/** A staff id, null when the assignment is cleared, or absent when the caller omitted it. */
export type OptionalStaffId = string | null | undefined

/** The kind of record a work item is about. */
export type SubjectType =
    | "lead"
    | "order"
    | "invoice"
    | "transaction"
    | "conversation"
    | "inbound"
    | "video_project"
    | "supplier_payable"

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
    /** When it was created. */
    readonly created_at: string
    /** When it last changed. */
    readonly updated_at: string
    /** When it finished. */
    readonly completed_at: string | null
    /** The agent instance that handles it. */
    readonly installation_id: string | null
    /** Who made the latest decision, by the name stored in the decision log. */
    readonly decidedBy?: string | null
    /** The display name of that latest decider. */
    readonly deciderName?: string | null
}

/** A work item, or null when none matches. */
export type OptionalWorkItem = WorkItem | null

/** What a new queued work item is made of. */
export interface NewWorkItem {
    /** The workspace. */
    readonly workspaceId: string
    /** The chain it joins; null starts a new chain with the item itself as its root. */
    readonly chainId: string | null
    /** Hops from the root of the chain. */
    readonly depth: number
    /** The module that performs it. */
    readonly department: string
    /** The action key. */
    readonly action: string
    /** The kind of record it is about. */
    readonly subjectType: SubjectType
    /** The record it is about. */
    readonly subjectId: string | null
    /** The customer. */
    readonly leadId: string | null
    /** The input that started it. */
    readonly inboundEventId: string | null
    /** The item that asked for it. */
    readonly parentId: string | null
    /** The idempotency key, unique per workspace. */
    readonly dedupeKey: string
    /** The first proposal. */
    readonly proposal: Proposal
    /** The agent instance; null lets the database resolve it. */
    readonly installationId: string | null
}

/** Why and for what an item waits for a person. */
export interface WaitingMark {
    /** The first reason. */
    readonly reason: ReasonCode
    /** Every reason. */
    readonly reasons: ReadonlyArray<ReasonCode>
    /** Required fields still missing. */
    readonly missing: ReadonlyArray<string>
    /** The proposal the person sees. */
    readonly proposal: Proposal
    /** The approval card, when the item has one. */
    readonly executionId: string | null
}

/** How an item finished. */
export interface DoneMark {
    /** By policy alone or by a person; the automatic path also records the routine reason. */
    readonly path: DecidedPath
    /** The proposal that was performed. */
    readonly proposal: Proposal
    /** What the performer reported. */
    readonly result: WorkResult
    /** How much evidence backs it. */
    readonly evidence: EvidenceState
    /** The customer the performer found or created; null keeps the stored one. */
    readonly leadId: string | null
}

/** A proposal as the database holds it: a legacy row may hold an empty object, so every key is optional. */
export interface StoredProposal {
    /** One sentence for the owner. */
    readonly summary?: string
    /** The text to send. */
    readonly draft?: string | undefined
    /** The money involved, VND. */
    readonly amount_vnd?: number | null | undefined
    /** The structured fields. */
    readonly fields?: Readonly<Record<string, ProposalFieldValue>>
    /** How sure the agent is, 0..1. */
    readonly confidence?: number
    /** Whether the outcome is clear. */
    readonly outcome?: "clear" | "unclear"
    /** The invoices a payment may settle. */
    readonly candidates?: ReadonlyArray<ProposalCandidate> | undefined
    /** The producer's execution choices, absent on older proposals. */
    readonly execution?: WorkExecutionOptions | undefined
}

/** One work item as the writes answer it (`RETURNING *`): CHECK-constrained columns narrowed, jsonb columns shaped, timestamps as `Date`. */
export interface WorkItemRecord {
    /** The id. */
    id: string
    /** The workspace. */
    workspace_id: string
    /** The module that performs it. */
    department: string
    /** The action key. */
    action: string
    /** Constrained by a CHECK in the table. */
    subject_type: SubjectType
    /** The record it is about. */
    subject_id: string | null
    /** The customer. */
    lead_id: string | null
    /** The input that started it. */
    inbound_event_id: string | null
    /** The item that asked for it. */
    parent_id: string | null
    /** The root of its command chain. */
    chain_id: string | null
    /** Hops from the root. */
    depth: number
    /** Constrained by a CHECK in the table. */
    status: WorkStatus
    /** Constrained by a CHECK in the table. */
    decided_path: DecidedPath | null
    /** Constrained by a CHECK in the table. */
    reason: ReasonCode | null
    /** Every reason. */
    reasons: Array<string>
    /** Required fields still missing. */
    missing_fields: Array<string>
    /** A legacy row may hold an empty object, so every key is optional here. */
    proposal: StoredProposal
    /** What the performer reported. */
    result: WorkResult | null
    /** The failure. */
    error: string | null
    /** Constrained by a CHECK in the table. */
    evidence_state: EvidenceState
    /** The staff member it is assigned to. */
    assigned_staff_id: string | null
    /** The approval execution. */
    execution_id: string | null
    /** When the row was written. */
    created_at: Date
    /** When the row last changed. */
    updated_at: Date
    /** When the work finished. */
    completed_at: Date | null
    /** The agent instance. */
    installation_id: string | null
}

/** The installation that owns an item, or null when there is no such item or it names none. */
export type OptionalInstallationId = string | null

/** Names the one item a guarded write changes: its id, and the workspace when the caller knows it. */
export interface WorkItemKey {
    /** The item. */
    readonly id: string
    /** The workspace the item must belong to, or absent when the id alone names it. */
    readonly workspaceId?: string
}
