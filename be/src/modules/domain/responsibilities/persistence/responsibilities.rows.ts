/** public.responsibilities as the statements select it: the due date as ISO text. */
export interface ResponsibilitiesRow {
    /** The responsibility row id. */
    readonly id: string
    /** The lead this follow-up belongs to. */
    readonly lead_id: string
    /** The short label shown on the follow-up card. */
    readonly title: string
    /** Whether a person or an agent owns the follow-up. */
    readonly owner_kind: string
    /** The owning agent when an agent owns it; null for a human owner. */
    readonly owner_agent_id: string | null
    /** The member who owns the follow-up when a person does; null for an agent owner. */
    readonly owner_member_id: string | null
    /** The owner's display name, kept so the card renders without a join. */
    readonly owner_name: string
    /** The next step the owner has to take. */
    readonly next_action: string
    /** When the next step is due, ISO text; null when it has no deadline. */
    readonly due_at: string | null
    /** The stored lifecycle status of the follow-up. */
    readonly status: string
}

/** public.agents as the owner lookups select it. */
export interface AgentsRow {
    /** The agent row id an owner_agent_id points at. */
    readonly id: string
    /** The agent's display name, copied into owner_name. */
    readonly name: string
}

/** public.workspace_members as the owner lookups select it. */
export interface MemberOwnerRow {
    /** The member id an owner_member_id points at. */
    readonly id: string
    /** The member's display name, copied into owner_name. */
    readonly display_name: string
}
