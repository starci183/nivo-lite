/** The window the dashboard reads and the one before it, as instants. */
export interface DashboardRange {
    /** The first instant of the period. */
    readonly from: Date
    /** The first instant after the period. */
    readonly to: Date
    /** The first instant of the period before it, of the same length. */
    readonly previousFrom: Date
}

/** What one agent (a department and, for a multi-instance type, its instance) did with one action. */
export interface AgentActionActivity {
    /** The department (module key). */
    readonly department: string
    /** The instance, or null for an item no instance owns. */
    readonly installationId: string | null
    /** The action key. */
    readonly action: string
    /** Items finished in the period. */
    readonly done: number
    /** Of those, decided by policy alone. */
    readonly autoDone: number
    /** Items that failed in the period. */
    readonly failed: number
    /** Items finished in the period before. */
    readonly previousDone: number
    /** Of those, decided by policy alone. */
    readonly previousAutoDone: number
}

/** How long an agent took, in the middle, to finish what policy alone decided. */
export interface AgentResponseTime {
    /** The department (module key). */
    readonly department: string
    /** The instance, or null. */
    readonly installationId: string | null
    /** The median, seconds; null when nothing was finished by policy in the period. */
    readonly medianSeconds: number | null
}

/** How many items wait for a decision on one agent, now. */
export interface AgentWaiting {
    /** The department (module key). */
    readonly department: string
    /** The instance, or null. */
    readonly installationId: string | null
    /** Items waiting. */
    readonly waiting: number
}

/** One item that waits for a person's decision. */
export interface WaitingApproval {
    /** The work item. */
    readonly id: string
    /** The department (module key). */
    readonly department: string
    /** The instance, or null. */
    readonly installationId: string | null
    /** The action key. */
    readonly action: string
    /** When it was raised, ISO 8601. */
    readonly createdAt: string
    /** The one-line summary the proposal carries, or null. */
    readonly summary: string | null
    /** The customer the proposal names, or null. */
    readonly customer: string | null
}

/** The items that wait for a decision: how many there are and the oldest few. */
export interface WaitingApprovals {
    /** Every item that waits. */
    readonly total: number
    /** The oldest items, at most the limit asked. */
    readonly items: ReadonlyArray<WaitingApproval>
}
