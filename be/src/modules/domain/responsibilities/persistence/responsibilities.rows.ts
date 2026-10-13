/** public.responsibilities as the statements select it: the due date as ISO text. */
export interface ResponsibilitiesRow {
    readonly id: string
    readonly lead_id: string
    readonly title: string
    readonly owner_kind: string
    readonly owner_agent_id: string | null
    readonly owner_name: string
    readonly next_action: string
    readonly due_at: string | null
    readonly status: string
}

/** public.agents as the owner lookups select it. */
export interface AgentsRow {
    readonly id: string
    readonly name: string
}
