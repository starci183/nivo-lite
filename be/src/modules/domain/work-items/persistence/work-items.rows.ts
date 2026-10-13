import type {
    DecidedPath,
    EvidenceState,
    Origin,
    StoredProposal,
    ReasonCode,
    SubjectType,
    WorkResult,
    WorkStatus,
} from "../work-items.contracts"

/** public.work_items as the driver answers it: CHECK-constrained columns narrowed, jsonb columns shaped, timestamps as `Date`. */
export interface WorkItemRow {
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
    /** Constrained by a CHECK in the table. */
    origin: Origin
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
export interface ClosedClaimRow {
    /** The item id. */
    id: string
    /** The input behind it, when there is one. */
    inbound_event_id: string | null
}
