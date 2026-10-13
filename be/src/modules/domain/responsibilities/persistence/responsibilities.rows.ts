/** public.responsibilities as the statements select it: the due date as ISO text. */
export interface ResponsibilitiesRow {
    /** Primary key of the responsibility. */
    readonly id: string
    /** The lead this responsibility is attached to. */
    readonly lead_id: string
    /** Short name shown on the board. */
    readonly title: string
    /** Whether a person or an agent owns the next step. */
    readonly owner_kind: string
    /** The agent that owns it, when the owner is an agent; otherwise none. */
    readonly owner_agent_id: string | null
    /** Display name of whoever owns the next step. */
    readonly owner_name: string
    /** What should happen next. */
    readonly next_action: string
    /** When it is due, as ISO text, or null when no due date is set. */
    readonly due_at: string | null
    /** Whether the responsibility is still open, waiting, or finished. */
    readonly status: string
}

/** public.agents as the owner lookups select it. */
export interface AgentsRow {
    /** Primary key of the agent. */
    readonly id: string
    /** Name shown beside the responsibilities this agent owns. */
    readonly name: string
}
