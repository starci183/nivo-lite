/** public.agents as the capability reads it. */
export interface AgentRow {
    /** The agent. */
    id: string
    /** The workspace. */
    workspace_id: string
    /** The module key. */
    module: string
    /** The display name. */
    name: string
    /** The @handle. */
    handle: string
    /** The one-line role. */
    role: string
    /** The owner's instructions. */
    instructions: string
    /** The owner's business notes. */
    knowledge: string
    /** The approval rule. */
    approval_rule: string
    /** Constrained by a CHECK in the table. */
    status: "active" | "paused"
    /** The HTTPS address of the picture the owner gave the agent, or null for the generated avatar. */
    avatar_url: string | null
    /** When the agent was created. */
    created_at: string
}

/** The id an update answers. */
export interface IdRow {
    /** The row that was changed. */
    id: string
}
