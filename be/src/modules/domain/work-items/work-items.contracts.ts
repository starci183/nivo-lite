/** Why the gate decided what it decided. */
export type ReasonCode = "routine" | "missing_data" | "over_authority" | "unclear_outcome" | "not_allowed"

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
    | "purchase_order"
    | "stock"
    | "video_project"

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

/** An item nobody touched for this many seconds is free to be taken over again (a worker crashed with it). */
export const CLAIM_LEASE_SECONDS = 120

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

/** What a performer prepared, and the corrections to the item's address; a null address part keeps the stored one. */
export interface PreparedSave {
    /** The proposal the gate judges. */
    readonly proposal: Proposal
    /** The corrected kind of record. */
    readonly subjectType: SubjectType | null
    /** The corrected record. */
    readonly subjectId: string | null
    /** The corrected customer. */
    readonly leadId: string | null
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

/** An approval that cannot go on because data is still missing or a candidate is still to be chosen. */
export interface StillWaitingMark {
    /** The proposal with the person's edits. */
    readonly proposal: Proposal
    /** Required fields still missing. */
    readonly missing: ReadonlyArray<string>
    /** The blocking reason. */
    readonly reason: ReasonCode
    /** Every reason. */
    readonly reasons: ReadonlyArray<ReasonCode>
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
    /** When the row last changed; also the lease of a claimed item. */
    updated_at: Date
    /** When the work finished. */
    completed_at: Date | null
    /** The agent instance. */
    installation_id: string | null
}

/** An item closed as settled. */
export interface ClosedClaim {
    /** The item id. */
    id: string
    /** The input behind it, when there is one. */
    inbound_event_id: string | null
}

/** The accounting work item's lineage in the accounting book. */
export interface AccountingWork {
    /** The item id. */
    readonly id: string
    /** The action key. */
    readonly action: string
    /** The work status. */
    readonly status: WorkStatus
    /** The type of record it is about. */
    readonly subject_type: SubjectType
    /** The record it is about. */
    readonly subject_id: string | null
    /** When the item was written, ISO text. */
    readonly created_at: string
}

/** Names the one item a guarded write changes: its id, and the workspace when the caller knows it. */
export interface WorkItemKey {
    /** The item. */
    readonly id: string
    /** The workspace the item must belong to, or absent when the id alone names it. */
    readonly workspaceId?: string
}
