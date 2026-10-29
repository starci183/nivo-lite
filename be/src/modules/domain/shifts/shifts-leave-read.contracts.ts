/** One approved leave of a staff member, as the booking calendar needs it. */
export interface ApprovedLeave {
    /** The staff member (the staff capability's id, not the shifts staff row). */
    readonly staffId: string
    /** The first day off, `YYYY-MM-DD`. */
    readonly fromDate: string
    /** The last day off, `YYYY-MM-DD`. */
    readonly toDate: string
}

/** What approved leave is asked for: which staff, and the two local dates the days must touch. */
export interface ApprovedLeaveQuery {
    /** The workspace. */
    readonly workspaceId: string
    /** The staff members whose leave is wanted. */
    readonly staffIds: ReadonlyArray<string>
    /** The first local date of the window, `YYYY-MM-DD`. */
    readonly from: string
    /** The last local date of the window, `YYYY-MM-DD`. */
    readonly to: string
}
