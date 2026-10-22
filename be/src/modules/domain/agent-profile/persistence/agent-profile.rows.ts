/** The header of an agent with its home room and instance mode. */
export interface AgentHeadRow {
    /** The agent. */
    id: string
    /** The display name. */
    name: string
    /** The @handle. */
    handle: string
    /** The one-line role. */
    role: string
    /** The module. */
    module: string
    /** active or paused. */
    status: string
    /** The home room's name, or null. */
    room_name: string | null
    /** assist or autopilot, or null when no instance drives the agent. */
    operating_mode: string | null
}

/** One rule of the owner's authority as the agent page lists it. */
export interface AppliedRuleRow {
    /** The action key. */
    action: string
    /** The module the action belongs to. */
    department: string
    /** auto, ask or never. */
    mode: "auto" | "ask" | "never"
    /** The action runs alone strictly below this amount, VND; null for none. */
    limit_vnd: number | null
    /** The note shown with the rule. */
    note: string
}

/** One piece of recent work of a department. */
export interface RecentWorkRow {
    /** The work item. */
    id: string
    /** The action key. */
    action: string
    /** queued, done, waiting_decision, rejected or failed. */
    status: "queued" | "done" | "waiting_decision" | "rejected" | "failed"
    /** When it was last touched. */
    at: string
    /** The one-line summary, or null. */
    summary: string | null
    /** The customer, or null. */
    customer: string | null
    /** The lead, or null. */
    lead_id: string | null
}
