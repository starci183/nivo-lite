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
    ShiftsAvailabilityEntity,
    ShiftsCoverageEntity,
    ShiftsLeaveRequestEntity,
    ShiftsPositionEntity,
    ShiftsSettingsEntity,
    ShiftsShiftEntity,
    ShiftsStaffEntity,
} from "../persistence/entities"
import { hhmm } from "./time.policy"
import { segOf } from "./work-rules.policy"

/** The facts of a shift the rules read: a stored shift, or any read that carries these columns. */
export type ShiftFacts = Pick<
    ShiftsShiftEntity,
    "id" | "shiftDate" | "startTime" | "endTime" | "positionId" | "staffId" | "status"
>

/** A shifts profile as the rules read it: the hour limits are database numerics, so they may arrive as text or as numbers. */
export type StaffFacts = Omit<ShiftsStaffEntity, "maxHoursWeek" | "maxHoursDay" | "minRestHours"> &
    Record<"maxHoursWeek" | "maxHoursDay" | "minRestHours", number | string>

/** The rules of a workspace as stored: the overtime limit is a database numeric and the opening hours are whatever json was saved. */
export type SettingsFacts = Omit<ShiftsSettingsEntity, "overtimeHoursWeek" | "openingHours"> & {
    readonly overtimeHoursWeek: number | string
    readonly openingHours: unknown
}

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
export const toPosition = (row: Pick<ShiftsPositionEntity, "id" | "name" | "color">): ShiftPosition => ({
    id: row.id,
    name: row.name,
    color: row.color === "" ? DEFAULT_COLOR : row.color,
})

/** A person with the wage the pay table gave them (zero when the caller may not read pay). */
export const toStaff = (row: StaffFacts, wage: number): ShiftStaff => ({
    id: row.id,
    name: row.name,
    positionIds: row.positionIds,
    skills: row.skills,
    wage,
    maxWeek: column(row.maxHoursWeek, DEFAULT_MAX_WEEK),
    maxDay: column(row.maxHoursDay, DEFAULT_MAX_DAY),
    minRest: Number(row.minRestHours) >= 0 ? Number(row.minRestHours) : DEFAULT_MIN_REST,
    staffRowId: row.staffId,
    telegramChatId: row.telegramChatId,
    zaloUserId: row.zaloUserId,
    phone: row.phone,
    active: row.active,
})

/** A coverage block. */
export const toBlock = (row: ShiftsCoverageEntity): Block => ({
    id: row.id,
    weekday: row.weekday,
    start: hhmm(row.startTime),
    end: hhmm(row.endTime),
    positionId: row.positionId,
    min: row.minStaff,
    ideal: row.idealStaff,
    peak: row.isPeak,
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
export const toSettings = (row: SettingsFacts | undefined): ShiftsSettings =>
    row === undefined
        ? DEFAULT_SETTINGS
        : {
              openingHours: openingOf(row.openingHours),
              swapNoticeHours: row.swapNoticeHours,
              leaveNoticeDays: row.leaveNoticeDays,
              remindMinutes: row.remindMinutes,
              noshowMinutes: row.noshowMinutes,
              overtimeHoursWeek: column(row.overtimeHoursWeek, DEFAULT_SETTINGS.overtimeHoursWeek),
          }

/** One approved availability statement. */
export const toAvail = (row: ShiftsAvailabilityEntity): Avail => ({
    staffId: row.staffId,
    weekday: row.weekday,
    date: row.shiftDate,
    start: hhmm(row.startTime),
    end: hhmm(row.endTime),
    available: row.available,
})

/** One approved leave. */
export const toLeave = (row: Pick<ShiftsLeaveRequestEntity, "staffId" | "fromDate" | "toDate">): Leave => ({
    staffId: row.staffId,
    from: row.fromDate,
    to: row.toDate,
})

/** One shift. */
export const toShift = (row: ShiftFacts): Shift => ({
    id: row.id,
    date: row.shiftDate,
    start: hhmm(row.startTime),
    end: hhmm(row.endTime),
    positionId: row.positionId,
    staffId: row.staffId,
    status: row.status,
})

/** The work of the day before a week, by person, for the rest rule across the week boundary. */
export const priorOf = (rows: ReadonlyArray<ShiftFacts>): Map<string, Array<Seg>> =>
    rows.reduce((by, row) => {
        const shift = toShift(row)
        return shift.staffId === null ? by : by.set(shift.staffId, [...(by.get(shift.staffId) ?? []), segOf(shift)])
    }, new Map<string, Array<Seg>>())
