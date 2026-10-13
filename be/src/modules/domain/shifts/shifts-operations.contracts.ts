/** Builds a draft schedule for the week that contains a day. */
export interface ProposeWeekParams {
    /** Any day of the week, YYYY-MM-DD. */
    readonly week: string
}

/** What a built draft ended in. */
export interface ProposeWeekOutput {
    /** The new draft schedule. */
    readonly scheduleId: string
    /** The version of the week the draft is. */
    readonly version: number
    /** The shifts in the draft. */
    readonly shifts: number
    /** The shifts nobody could take. */
    readonly open: number
    /** The coverage windows below their minimum. */
    readonly short: number
    /** The estimated wage cost in dong. */
    readonly costVnd: number
}

/** Writes the explanation of a schedule again. */
export interface ExplainScheduleParams {
    /** The schedule. */
    readonly scheduleId: string
}

/** The explanation of a schedule. */
export interface ExplainScheduleOutput {
    /** The text. */
    readonly explanation: string
}

/** Gives a draft shift to another person or opens it. */
export interface ReassignShiftParams {
    /** The shift. */
    readonly shiftId: string
    /** The person, or null to open the shift. */
    readonly staffId: string | null
}

/** Adds a shift to a draft schedule. */
export interface AddDraftShiftParams {
    /** The draft schedule. */
    readonly scheduleId: string
    /** The day, YYYY-MM-DD. */
    readonly date: string
    /** The start, HH:MM. */
    readonly start: string
    /** The end, HH:MM. */
    readonly end: string
    /** The position. */
    readonly positionId: string
    /** The person, or null for an open shift. */
    readonly staffId: string | null
}

/** Removes a shift from a draft schedule. */
export interface RemoveDraftShiftParams {
    /** The shift. */
    readonly shiftId: string
}

/** Puts a draft schedule before the owner to publish. */
export interface RequestPublishParams {
    /** The draft schedule. */
    readonly scheduleId: string
}

/** What asking for a decision ended in. */
export interface RequestOutput {
    /** The status of the decision: done when it ran at once, waiting_decision when a person must decide. */
    readonly status: string
}

/** A person hands a shift over or takes an open one. */
export interface RequestSwapParams {
    /** swap: hand the shift to another person; claim: take an open shift. */
    readonly kind: "swap" | "claim"
    /** The shift. */
    readonly shiftId: string
    /** The person who takes the shift; for a claim it is the member who asks. */
    readonly toStaffId: string | null
    /** The reason typed. */
    readonly reason: string
}

/** A person asks for leave. */
export interface RequestLeaveParams {
    /** The first day, YYYY-MM-DD. */
    readonly from: string
    /** The last day, YYYY-MM-DD. */
    readonly to: string
    /** The reason typed. */
    readonly reason: string
}

/** Reads the quick import text and sets the shop up from it. */
export interface ApplyImportParams {
    /** The positions, one per line or separated by commas. */
    readonly positions: string
    /** The people, one per line. */
    readonly staff: string
    /** The coverage, one per line. */
    readonly coverage: string
}

/** What the quick import added. */
export interface ApplyImportOutput {
    /** The positions added. */
    readonly positions: number
    /** The people added. */
    readonly staff: number
    /** The coverage blocks added. */
    readonly blocks: number
}
