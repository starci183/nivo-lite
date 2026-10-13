/** One thing somebody owes a customer. */
export class ResponsibilityResponse {
    /** The id. */
    id!: string
    /** The workspace. */
    workspace_id!: string
    /** The customer. */
    lead_id!: string
    /** What it is. */
    title!: string
    /** Person or agent. */
    owner_kind!: string
    /** The owning agent, when an agent owns it. */
    owner_agent_id!: string | null
    /** The display name of the owner. */
    owner_name!: string
    /** The next step. */
    next_action!: string
    /** When it is due, ISO 8601. */
    due_at!: string | null
    /** Where it stands: open, waiting_approval or done. */
    status!: string
    /** When it was created, ISO 8601. */
    created_at!: string
}

/** A responsibility with the name of its customer. */
export class ResponsibilityListingResponse extends ResponsibilityResponse {
    /** The customer's name. */
    contact_name!: string
}
