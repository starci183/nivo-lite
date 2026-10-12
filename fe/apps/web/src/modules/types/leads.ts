/** The stages of a lead journey, in order; the last two close it. */
export type LeadStage = "new" | "qualified" | "proposal" | "won" | "lost"

/** Who owns a step of a lead journey. */
export type OwnerKind = "human" | "agent"

/** Where a step of a lead journey stands. */
export type ResponsibilityStatus = "open" | "waiting_approval" | "done"

/** Where an agent draft stands. */
export type ExecutionStatus = "pending_approval" | "approved" | "rejected"

/** Plain data of one lead as the Leads screens read it. */
export interface LeadRecord {
    readonly id: string
    readonly contact_name: string
    readonly company: string
    readonly channel: string
    readonly need: string
    readonly stage: LeadStage
    /** The AI-prepared brief; null until one is prepared. */
    readonly context_summary: string | null
    /** `live`, `simulated` or null for a lead recorded before origins existed. */
    readonly origin: string | null
    readonly created_at: string
}

/** One lead of the list with the owner and next action of its open step. */
export interface LeadListItem extends LeadRecord {
    readonly owner_name: string | null
    readonly next_action: string | null
}

/** One step of a lead journey as a person or an agent owns it. */
export interface ResponsibilityRecord {
    readonly id: string
    readonly lead_id: string
    readonly title: string
    readonly owner_kind: OwnerKind
    readonly owner_agent_id: string | null
    readonly owner_name: string
    readonly next_action: string
    readonly due_at: string | null
    readonly status: ResponsibilityStatus
    readonly created_at: string
}

/** One draft an agent wrote for a step, waiting for or past a decision. */
export interface ExecutionRecord {
    readonly id: string
    readonly responsibility_id: string
    readonly agent_id: string | null
    readonly kind: string
    readonly draft: string
    readonly status: ExecutionStatus
    readonly decided_by: string | null
    readonly decided_at: string | null
    readonly work_item_id: string | null
    readonly created_at: string
}

/** One line of the append-only evidence log of a lead. */
export interface EventRecord {
    readonly id: string
    readonly lead_id: string | null
    readonly kind: string
    readonly actor: string
    readonly summary: string
    readonly evidence: string | null
    readonly created_at: string
}

/** An agent of the workspace as the owner choice lists it. */
export interface AgentRecord {
    readonly id: string
    readonly name: string
    readonly handle: string
    readonly status: string
    readonly module: string
}

/** Everything the lead page reads about one lead. */
export interface LeadDetail {
    readonly lead: LeadRecord
    readonly responsibilities: ReadonlyArray<ResponsibilityRecord>
    readonly executions: ReadonlyArray<ExecutionRecord>
    readonly events: ReadonlyArray<EventRecord>
    readonly agents: ReadonlyArray<AgentRecord>
}

/** What the header's single primary action does for a lead right now. */
export type LeadPrimaryAction =
    | { readonly kind: "draft"; readonly responsibilityId: string }
    | { readonly kind: "review" }
    | { readonly kind: "propose" }
    | { readonly kind: "none" }

/** One step of the lead journey with whether real data says it is done. */
export interface JourneyStep {
    readonly id: string
    readonly label: string
    readonly isDone: boolean
}
