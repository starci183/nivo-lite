import type { ShiftsShiftRow } from "./shifts.rows"

/** One person of the shifts with the channels they are linked to. */
export interface NotifyPersonRow {
    /** The shifts profile id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The shop's staff row (the Office handle). */
    readonly staff_id: string | null
    /** The Telegram chat. */
    readonly telegram_chat_id: string | null
    /** The Zalo user. */
    readonly zalo_user_id: string | null
}

/** A staff row an Office handle is made from. */
export interface HandleStaffRow {
    /** The staff row id. */
    readonly id: string
    /** The name. */
    readonly name: string
}

/** The handle of an agent. */
export interface AgentHandleRow {
    /** The handle. */
    readonly handle: string
}

/** An id. */
export interface AgentIdRow {
    /** The id. */
    readonly id: string
}

/** A workspace whose shift reminders are on. */
export interface ReminderWorkspaceRow {
    /** The workspace. */
    readonly workspace_id: string
    /** The automation settings (`beforeMinutes`, `noShowMinutes`). */
    readonly config: Readonly<Record<string, unknown>> | null
    /** The module default of the reminder lead time, when the module is set up. */
    readonly remind_minutes: number | null
    /** The module default of the no-show delay, when the module is set up. */
    readonly noshow_minutes: number | null
}

/** Whether something is on. */
export interface EnabledRow {
    /** True when it is. */
    readonly enabled: boolean
}

/** Whether something was done. */
export interface DoneRow {
    /** True when it was. */
    readonly done: boolean
}

/** A live assigned shift with its alert flags. */
export interface AlertShiftRow extends Pick<
    ShiftsShiftRow,
    "id" | "schedule_id" | "shift_date" | "start_time" | "end_time" | "position_id" | "staff_id" | "status"
> {
    /** The person checked in. */
    readonly checked_in: boolean
    /** The person was reminded. */
    readonly reminded: boolean
    /** The managers were told nobody checked in. */
    readonly alerted: boolean
}

/** A name. */
export interface NameRow {
    /** The name. */
    readonly name: string
}

/** A workspace whose monthly close is on. */
export interface MonthCloseWorkspaceRow {
    /** The workspace. */
    readonly workspace_id: string
    /** The automation settings (`day`, `time`). */
    readonly config: Readonly<Record<string, unknown>> | null
}

/** A member's account. */
export interface OwnerRow {
    /** The account. */
    readonly user_id: string
}
