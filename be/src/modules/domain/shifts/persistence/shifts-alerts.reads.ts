/** The handle of an agent. */
export interface AgentHandleRead {
    /** The handle. */
    readonly handle: string
}

/** An id. */
export interface AgentIdRead {
    /** The id. */
    readonly id: string
}

/** A workspace whose shift reminders are on (a raw read of the automation pipelines joined with the shifts rules). */
export interface ReminderWorkspaceRead {
    /** The workspace. */
    readonly workspace_id: string
    /** The automation settings (`beforeMinutes`, `noShowMinutes`). */
    readonly config: Readonly<Record<string, unknown>> | null
    /** The module default of the reminder lead time, when the module is set up. */
    readonly remind_minutes: number | null
    /** The module default of the no-show delay, when the module is set up. */
    readonly noshow_minutes: number | null
}

/** A live assigned shift with its alert flags. */
export interface AlertShiftRead {
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
    /** The person, or null. */
    readonly staff_id: string | null
    /** The shift status. */
    readonly status: string
    /** The person checked in. */
    readonly checked_in: boolean
    /** The person was reminded. */
    readonly reminded: boolean
    /** The managers were told nobody checked in. */
    readonly alerted: boolean
}

/** A name. */
export interface NameRead {
    /** The name. */
    readonly name: string
}

/** A workspace whose monthly close is on. */
export interface MonthCloseWorkspaceRead {
    /** The workspace. */
    readonly workspace_id: string
    /** The automation settings (`day`, `time`). */
    readonly config: Readonly<Record<string, unknown>> | null
}

/** A member's account. */
export interface OwnerRead {
    /** The account. */
    readonly user_id: string
}
