/** What deciding whether a member may hand an agent work needs. */
export interface AssignContext {
    /** The member's role. */
    readonly role: string
    /** The member's status. */
    readonly memberStatus: string
    /** The agent's status. */
    readonly agentStatus: string
    /** The roles the agent is open to. */
    readonly assignableRoles: ReadonlyArray<string>
    /** The room keys the agent is open to. */
    readonly assignableRooms: ReadonlyArray<string>
    /** The room keys the member sits in. */
    readonly memberRooms: ReadonlyArray<string>
}

/** What deciding whether one agent may tag another needs. */
export interface TagContext {
    /** The tagging agent's status. */
    readonly fromStatus: string
    /** The tagged agent's status. */
    readonly toStatus: string
    /** Whether both agents belong to one workspace. */
    readonly sameWorkspace: boolean
    /** Whether the tagged agent is on the tagging agent's list. */
    readonly listed: boolean
    /** Whether both are the same agent. */
    readonly sameAgent: boolean
}

/** One member as the ownership cards show them, with the first department room they sit in. */
export interface MemberState {
    /** The seat id. */
    readonly id: string
    /** The name shown. */
    readonly displayName: string
    /** The role. */
    readonly role: "owner" | "manager" | "staff"
    /** Active or disabled. */
    readonly status: "active" | "disabled"
    /** The key of the first department room, or null. */
    readonly roomKey: string | null
}

/** One work item of the dashboard lists, with the lead's name folded in. */
export interface DashboardLine {
    /** The work item. */
    readonly id: string
    /** The action key. */
    readonly action: string
    /** The lead, or null. */
    readonly leadId: string | null
    /** When the item was raised (waiting) or finished (done), ISO 8601 as the query writes it. */
    readonly at: string
    /** The proposal or result summary, or null. */
    readonly summary: string | null
    /** The customer name, or null. */
    readonly customer: string | null
    /** The href the finished work recorded, or null. */
    readonly resultHref: string | null
    /** How many rows match before the limit. */
    readonly total: string
}

/** An instant as ISO text, or null when there is none. */
export type OptionalInstant = string | null

/** Reads when the agent copies were last checked. */
export type SyncCheckReader = () => Promise<OptionalInstant>
