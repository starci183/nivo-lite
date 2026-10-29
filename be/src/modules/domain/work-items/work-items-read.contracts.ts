/** A work item as the governance figures of the dashboard read it. */
export interface WorkFigure {
    /** The work item id. */
    readonly id: string
    /** The customer, when there is one. */
    readonly leadId: string | null
    /** The department doing the work. */
    readonly department: string
    /** The state of the work. */
    readonly status: string
    /** Why it stands where it stands, or null. */
    readonly reason: string | null
    /** How it was decided, or null. */
    readonly decidedPath: string | null
    /** When it was created. */
    readonly createdAt: Date
    /** When it last changed. */
    readonly updatedAt: Date
    /** When it finished, or null. */
    readonly completedAt: Date | null
    /** The proposal's summary, when it has one. */
    readonly summary: string | null
    /** The contact name inside the proposal, when it has one. */
    readonly contact: string | null
    /** The customer name inside the proposal, when it has one. */
    readonly customer: string | null
}

/** A work item waiting for a decision or failed, as the exceptions list of the dashboard shows it. */
export interface WorkException {
    /** The work item id. */
    readonly id: string
    /** The customer, when there is one. */
    readonly leadId: string | null
    /** The department doing the work. */
    readonly department: string
    /** The action asked for. */
    readonly action: string
    /** The state of the work. */
    readonly status: string
    /** Why it stands where it stands, or null. */
    readonly reason: string | null
    /** The failure text, or null. */
    readonly error: string | null
    /** The execution behind it, or null. */
    readonly executionId: string | null
    /** The staff member it is assigned to, or null. */
    readonly assignedStaffId: string | null
    /** When it was created. */
    readonly createdAt: Date
    /** The proposal's summary, when it has one. */
    readonly summary: string | null
    /** The contact name inside the proposal, when it has one. */
    readonly contact: string | null
    /** The customer name inside the proposal, when it has one. */
    readonly customer: string | null
}
