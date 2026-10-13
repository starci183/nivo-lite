import type {
    Avail,
    Block,
    Leave,
    OpeningDay,
    Seg,
    Shift,
    ShiftPosition,
    ShiftStaff,
    ShiftsSettings,
} from "../shifts.contracts"
import type {
    ShiftsAvailabilityRow,
    ShiftsCoverageRow,
    ShiftsLeaveRow,
    ShiftsPositionRow,
    ShiftsSettingsRow,
    ShiftsShiftRow,
    ShiftsStaffRow,
} from "../persistence/shifts.rows"
import { hhmm } from "./time.policy"
import { segOf } from "./work-rules.policy"

/** The rules a workspace has until its owner sets them. */
export const DEFAULT_SETTINGS: ShiftsSettings = {
    openingHours: [],
    swapNoticeHours: 24,
    leaveNoticeDays: 2,
    remindMinutes: 60,
    noshowMinutes: 10,
    overtimeHoursWeek: 48,
}

/** The colour a position without one is drawn in. */
const DEFAULT_COLOR = "#2f6fed"

const DEFAULT_MAX_WEEK = 48
const DEFAULT_MAX_DAY = 10
const DEFAULT_MIN_REST = 10

/** A database number (decimal text or number) as a number; the fallback for anything unreadable or zero. */
const column = (value: number | string | null | undefined, fallback: number): number => Number(value) || fallback

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The positions a workspace works with. */
export const toPosition = (row: ShiftsPositionRow): ShiftPosition => ({
    id: row.id,
    name: row.name,
    color: row.color === "" ? DEFAULT_COLOR : row.color,
})

/** A person with the wage the pay table gave them (zero when the caller may not read pay). */
export const toStaff = (row: ShiftsStaffRow, wage: number): ShiftStaff => ({
    id: row.id,
    name: row.name,
    positionIds: row.position_ids,
    skills: row.skills,
    wage,
    maxWeek: column(row.max_hours_week, DEFAULT_MAX_WEEK),
    maxDay: column(row.max_hours_day, DEFAULT_MAX_DAY),
    minRest: Number(row.min_rest_hours) >= 0 ? Number(row.min_rest_hours) : DEFAULT_MIN_REST,
    staffRowId: row.staff_id,
    telegramChatId: row.telegram_chat_id,
    zaloUserId: row.zalo_user_id,
    phone: row.phone,
    active: row.active,
})

/** A coverage block. */
export const toBlock = (row: ShiftsCoverageRow): Block => ({
    id: row.id,
    weekday: row.weekday,
    start: hhmm(row.start_time),
    end: hhmm(row.end_time),
    positionId: row.position_id,
    min: row.min_staff,
    ideal: row.ideal_staff,
    peak: row.is_peak,
})

const openingOf = (value: unknown): Array<OpeningDay> =>
    isRecord(value)
        ? Object.entries(value).flatMap(([weekday, day]) =>
              isRecord(day) && typeof day.open === "string" && typeof day.close === "string"
                  ? [{ weekday: Number(weekday), open: day.open, close: day.close }]
                  : [],
          )
        : []

/** The rules of a workspace; the defaults when its owner has set none. */
export const toSettings = (row: ShiftsSettingsRow | undefined): ShiftsSettings =>
    row === undefined
        ? DEFAULT_SETTINGS
        : {
              openingHours: openingOf(row.opening_hours),
              swapNoticeHours: row.swap_notice_hours,
              leaveNoticeDays: row.leave_notice_days,
              remindMinutes: row.remind_minutes,
              noshowMinutes: row.noshow_minutes,
              overtimeHoursWeek: column(row.overtime_hours_week, DEFAULT_SETTINGS.overtimeHoursWeek),
          }

/** One approved availability statement. */
export const toAvail = (row: ShiftsAvailabilityRow): Avail => ({
    staffId: row.staff_id,
    weekday: row.weekday,
    date: row.shift_date,
    start: hhmm(row.start_time),
    end: hhmm(row.end_time),
    available: row.available,
})

/** One approved leave. */
export const toLeave = (row: ShiftsLeaveRow): Leave => ({ staffId: row.staff_id, from: row.from_date, to: row.to_date })

/** One shift. */
export const toShift = (row: ShiftsShiftRow): Shift => ({
    id: row.id,
    date: row.shift_date,
    start: hhmm(row.start_time),
    end: hhmm(row.end_time),
    positionId: row.position_id,
    staffId: row.staff_id,
    status: row.status,
})

/** The work of the day before a week, by person, for the rest rule across the week boundary. */
export const priorOf = (rows: ReadonlyArray<ShiftsShiftRow>): Map<string, Array<Seg>> =>
    rows.reduce((by, row) => {
        const shift = toShift(row)
        return shift.staffId === null ? by : by.set(shift.staffId, [...(by.get(shift.staffId) ?? []), segOf(shift)])
    }, new Map<string, Array<Seg>>())
