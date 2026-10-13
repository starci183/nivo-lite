/** The columns of public.shifts_schedules the workbench reads. */
export interface WorkbenchScheduleRow {
    /** The schedule id. */
    readonly id: string
    /** The Monday of the week. */
    readonly week_start: string
    /** The version of the week. */
    readonly version: number
    /** draft, published or superseded. */
    readonly status: string
    /** solver or manual. */
    readonly source: string
    /** The estimated wage cost; bigint arrives as text. */
    readonly cost_vnd: number | string
    /** The written explanation. */
    readonly explanation: string
    /** How long the solver ran. */
    readonly solver_ms: number | null
    /** Coverage and hours counts. */
    readonly summary: Record<string, unknown> | null
    /** What the solver and the checks found. */
    readonly evidence: Record<string, unknown> | null
    /** The publish decision. */
    readonly work_item_id: string | null
    /** When it was made. */
    readonly created_at: Date | string
    /** When it was published. */
    readonly published_at: Date | string | null
}

/** The columns of public.shifts_leave_requests the workbench reads. */
export interface WorkbenchLeaveRow {
    /** The request id. */
    readonly id: string
    /** The person. */
    readonly staff_id: string
    /** The first day. */
    readonly from_date: string
    /** The last day. */
    readonly to_date: string
    /** The reason. */
    readonly reason: string
    /** pending, approved or declined. */
    readonly status: string
    /** The decision it waits on. */
    readonly work_item_id: string | null
    /** When it was filed. */
    readonly created_at: Date | string
}

/** The columns of public.shifts_swap_requests the workbench reads. */
export interface WorkbenchSwapRow {
    /** The request id. */
    readonly id: string
    /** swap or claim. */
    readonly kind: string
    /** The shift. */
    readonly shift_id: string
    /** Who offers the shift. */
    readonly from_staff_id: string | null
    /** Who takes the shift. */
    readonly to_staff_id: string
    /** The reason. */
    readonly reason: string
    /** pending, approved or declined. */
    readonly status: string
    /** The rule findings at decision time. */
    readonly checks: Array<string> | null
    /** The decision it waits on. */
    readonly work_item_id: string | null
    /** When it was filed. */
    readonly created_at: Date | string
}

/** The columns of public.shifts_availability the workbench reads. */
export interface WorkbenchAvailabilityRow {
    /** The statement id. */
    readonly id: string
    /** The person. */
    readonly staff_id: string
    /** The weekday of a recurring statement. */
    readonly weekday: number | null
    /** The day of a one-day statement. */
    readonly shift_date: string | null
    /** The window start. */
    readonly start_time: string
    /** The window end. */
    readonly end_time: string
    /** True when the person can work. */
    readonly available: boolean
    /** A free note. */
    readonly note: string
    /** pending, approved or declined. */
    readonly status: string
    /** When it was filed. */
    readonly created_at: Date | string
}

/** The columns of public.work_items the workbench reads. */
export interface WorkbenchItemRow {
    /** The decision id. */
    readonly id: string
    /** Its status. */
    readonly status: string
    /** The proposal. */
    readonly proposal: Record<string, unknown> | null
    /** The result. */
    readonly result: Record<string, unknown> | null
    /** How it was decided. */
    readonly decided_path: string | null
}

/** One check-in row of public.shifts_attendance. */
export interface WorkbenchAttendanceRow {
    /** The shift. */
    readonly shift_id: string
    /** When the person checked in. */
    readonly checked_in_at: Date | string
}

/** One shift row of public.shifts_shifts, without the schedule join. */
export interface WorkbenchShiftRow {
    /** The shift id. */
    readonly id: string
    /** The day. */
    readonly shift_date: string
    /** The start. */
    readonly start_time: string
    /** The end. */
    readonly end_time: string
    /** The position. */
    readonly position_id: string
    /** The person, null for an open shift. */
    readonly staff_id: string | null
    /** draft, published, swapped or cancelled. */
    readonly status: string
}

/** One active shop staff row. */
export interface WorkbenchStaffRow {
    /** The staff row id. */
    readonly id: string
    /** The person's name. */
    readonly name: string
}

/** A count answer. */
export interface CountRow {
    /** The count. */
    readonly n: number | string
}

/** The scheduled minutes of a month. */
export interface MinutesRow {
    /** The minutes. */
    readonly minutes: number | string
}

/** Whether a pipeline is on. */
export interface EnabledRow {
    /** The flag. */
    readonly enabled: boolean
}
