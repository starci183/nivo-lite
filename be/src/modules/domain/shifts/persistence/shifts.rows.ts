/** The columns of public.shifts_positions the domain reads. */
export interface ShiftsPositionRow {
    /** The position id. */
    readonly id: string
    /** The position name. */
    readonly name: string
    /** The colour the grid draws it in. */
    readonly color: string
}

/** The columns of public.shifts_staff the domain reads; numeric columns arrive as decimal text. */
export interface ShiftsStaffRow {
    /** The profile id. */
    readonly id: string
    /** The person's name. */
    readonly name: string
    /** The shop's staff row this profile is linked to. */
    readonly staff_id: string | null
    /** The phone number. */
    readonly phone: string | null
    /** The Telegram chat shift messages also go to. */
    readonly telegram_chat_id: string | null
    /** The Zalo user shift messages also go to. */
    readonly zalo_user_id: string | null
    /** The positions the person can work. */
    readonly position_ids: Array<string>
    /** Free-form skills. */
    readonly skills: Array<string>
    /** The most hours a week. */
    readonly max_hours_week: number | string
    /** The most hours a day. */
    readonly max_hours_day: number | string
    /** The fewest hours of rest between two working days. */
    readonly min_rest_hours: number | string
    /** False once the person has left. */
    readonly active: boolean
}

/** The columns of public.shifts_staff_pay the domain reads. */
export interface ShiftsPayRow {
    /** The profile the wage belongs to. */
    readonly staff_id: string
    /** The hourly wage in dong. */
    readonly hourly_wage_vnd: number | string
}

/** The columns of public.shifts_coverage the domain reads. */
export interface ShiftsCoverageRow {
    /** The coverage row id. */
    readonly id: string
    /** The weekday, 0 Monday to 6 Sunday. */
    readonly weekday: number
    /** The window start. */
    readonly start_time: string
    /** The window end. */
    readonly end_time: string
    /** The position. */
    readonly position_id: string
    /** The fewest people. */
    readonly min_staff: number
    /** The ideal people. */
    readonly ideal_staff: number
    /** True for a peak window. */
    readonly is_peak: boolean
}

/** The columns of public.shifts_settings the domain reads. */
export interface ShiftsSettingsRow {
    /** The opening hours by weekday as stored. */
    readonly opening_hours: unknown
    /** Hours of notice a swap needs. */
    readonly swap_notice_hours: number
    /** Days of notice a leave needs. */
    readonly leave_notice_days: number
    /** Minutes before a shift the reminder goes out. */
    readonly remind_minutes: number
    /** Minutes after the start the owner is told nobody checked in. */
    readonly noshow_minutes: number
    /** Hours per week after which work is paid at +50%. */
    readonly overtime_hours_week: number | string
}

/** The columns of public.shifts_availability the domain reads. */
export interface ShiftsAvailabilityRow {
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
    /** True when the person can work in the window. */
    readonly available: boolean
}

/** The columns of public.shifts_leave_requests the domain reads. */
export interface ShiftsLeaveRow {
    /** The request id. */
    readonly id: string
    /** The person. */
    readonly staff_id: string
    /** The first day. */
    readonly from_date: string
    /** The last day. */
    readonly to_date: string
    /** The reason typed. */
    readonly reason: string
    /** pending, approved or declined. */
    readonly status: string
}

/** The columns of public.shifts_swap_requests the domain reads. */
export interface ShiftsSwapRow {
    /** The request id. */
    readonly id: string
    /** swap or claim. */
    readonly kind: string
    /** The shift. */
    readonly shift_id: string
    /** The person offering the shift, null for a claim. */
    readonly from_staff_id: string | null
    /** The person taking the shift. */
    readonly to_staff_id: string
    /** pending, approved or declined. */
    readonly status: string
}

/** The columns of public.shifts_schedules the domain reads. */
export interface ShiftsScheduleRow {
    /** The schedule id. */
    readonly id: string
    /** The Monday of the week. */
    readonly week_start: string
    /** The version of the week. */
    readonly version: number
    /** draft, published or superseded. */
    readonly status: string
    /** The estimated wage cost. */
    readonly cost_vnd: number | string
    /** The coverage and hours summary. */
    readonly summary: unknown
    /** What the solver and the checks found. */
    readonly evidence: unknown
}

/** The columns of public.shifts_shifts the domain reads, with the status and week of its schedule. */
export interface ShiftsShiftRow {
    /** The shift id. */
    readonly id: string
    /** The schedule it belongs to. */
    readonly schedule_id: string
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
    /** The status of the schedule the shift belongs to. */
    readonly schedule_status: string
    /** The Monday of the schedule's week. */
    readonly week_start: string
}

/** The columns of public.shifts_commands the job reads. */
export interface ShiftsCommandsRow {
    /** The command id. */
    readonly id: string
    /** The workspace the command acts in. */
    readonly workspace_id: string
    /** What the command asks for. */
    readonly kind: string
    /** The typed input of the command as submitted. */
    readonly input: unknown
    /** queued, done or failed. */
    readonly status: string
    /** The member who submitted the command. */
    readonly created_by: string
}

/** A single id column. */
export interface ShiftsIdRow {
    /** The id. */
    readonly id: string | null
}
