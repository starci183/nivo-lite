/** One invoice a payment may settle. */
export class ProposalCandidateResponse {
    /** The invoice id. */
    id!: string
    /** The line the owner reads. */
    label!: string
    /** The amount of the invoice, VND. */
    amount_vnd!: number
}

/** What an agent proposes to do. */
export class ProposalResponse {
    /** One sentence for the owner. */
    summary!: string
    /** The text to send, when the action sends one. */
    draft?: string
    /** The money involved, VND. */
    amount_vnd?: number | null
    /** The structured fields of the proposal. */
    fields!: Readonly<Record<string, string | number | null>>
    /** How sure the agent is, 0..1. */
    confidence?: number
    /** Whether the outcome is clear. */
    outcome?: "clear" | "unclear"
    /** The invoices a payment may settle. */
    candidates?: ReadonlyArray<ProposalCandidateResponse>
}

/** What a performer reported it did. */
export class WorkResultResponse {
    /** One sentence for the log. */
    summary!: string
    /** Where the owner can see it. */
    href?: string
}

/** One work item as the Decisions and Approvals pages read it. */
export class WorkItemResponse {
    /** The id. */
    id!: string
    /** The workspace. */
    workspace_id!: string
    /** The module that performs it. */
    department!: string
    /** The action key. */
    action!: string
    /** The kind of record it is about. */
    subject_type!: string
    /** The id of that record. */
    subject_id!: string | null
    /** The customer it is about. */
    lead_id!: string | null
    /** The input that started it. */
    inbound_event_id!: string | null
    /** The item that asked for it. */
    parent_id!: string | null
    /** The root of its command chain. */
    chain_id!: string | null
    /** Hops from the root. */
    depth!: number
    /** Where it stands: queued, done, waiting_decision, rejected or failed. */
    status!: string
    /** How it was decided: auto or human. */
    decided_path!: string | null
    /** Who made the latest decision, by the name stored in the decision log. */
    decidedBy?: string | null
    /** The display name of that latest decider. */
    deciderName?: string | null
    /** Why the gate asked. */
    reason!: string | null
    /** Every reason, the first one is `reason`. */
    reasons!: ReadonlyArray<string>
    /** Required fields still missing. */
    missing_fields!: ReadonlyArray<string>
    /** What the agent proposes. */
    proposal!: ProposalResponse
    /** What was done. */
    result!: WorkResultResponse | null
    /** The failure, when it failed. */
    error!: string | null
    /** How much evidence backs the result. */
    evidence_state!: string
    /** The staff member it is assigned to. */
    assigned_staff_id!: string | null
    /** The approval card behind it. */
    execution_id!: string | null
    /** Real or simulated. */
    origin!: string
    /** When it was created, ISO 8601. */
    created_at!: string
    /** When it last changed, ISO 8601. */
    updated_at!: string
    /** When it finished, ISO 8601. */
    completed_at!: string | null
    /** The agent instance that handles it. */
    installation_id!: string | null
}
