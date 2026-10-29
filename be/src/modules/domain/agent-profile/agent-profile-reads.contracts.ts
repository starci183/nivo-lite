/** The header of an agent with its home room and instance mode, as the page query selects it. */
export interface AgentHeadRead {
    /** The agent. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** The @handle. */
    readonly handle: string
    /** The one-line role. */
    readonly role: string
    /** The module. */
    readonly module: string
    /** active or paused. */
    readonly status: string
    /** The HTTPS address of the agent's picture, or null for the generated avatar. */
    readonly avatarUrl: string | null
    /** The home room's name, or null. */
    readonly roomName: string | null
    /** assist or autopilot, or null when no instance drives the agent. */
    readonly operatingMode: string | null
}

/** One piece of recent work of a department, as the page query selects it. */
export interface RecentWorkRead {
    /** The work item. */
    readonly id: string
    /** The action key. */
    readonly action: string
    /** queued, done, waiting_decision, rejected or failed. */
    readonly status: "queued" | "done" | "waiting_decision" | "rejected" | "failed"
    /** When it was last touched, ISO 8601 as the query writes it. */
    readonly at: string
    /** The one-line summary, or null. */
    readonly summary: string | null
    /** The customer, or null. */
    readonly customer: string | null
    /** The lead, or null. */
    readonly leadId: string | null
}
