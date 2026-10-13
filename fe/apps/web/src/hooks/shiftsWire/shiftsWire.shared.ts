import type {
    ShiftPositionType,
    ShiftStaffType,
    ShiftType,
    ShiftsAvailType,
    ShiftsAvailabilityType,
    ShiftsBlockType,
    ShiftsLeaveType,
    ShiftsSettingsType,
    ShiftsSetupType,
    ShiftsSwapType,
    ShiftsWorkItemType,
} from "@/modules/api"
import type {
    ShiftsAvailRowView,
    ShiftsAvailView,
    ShiftsBlockView,
    ShiftsLeaveRowView,
    ShiftsPositionView,
    ShiftsSettingsView,
    ShiftsSetupView,
    ShiftsShiftView,
    ShiftsStaffView,
    ShiftsSwapRowView,
    ShiftsWorkItemView,
} from "@/modules/types"

/** The shifts GraphQL features emit every list as `[[T!]!]`: the outer array is the list and each element carries its row alone. */
export const flat = <T>(rows: ReadonlyArray<ReadonlyArray<T>> | null | undefined): Array<T> => (rows ?? []).flat()

/** A wire time ("07:00:00" or "07:00") as the "HH:MM" the screens show and compare. */
export const hhmm = (time: string): string => time.slice(0, 5)

/** The agent work item of a request as the panels read it. */
export const toWorkItemView = (row: ShiftsWorkItemType | null | undefined): ShiftsWorkItemView | null =>
    row === null || row === undefined
        ? null
        : {
              id: row.id,
              status: row.status,
              summary: row.summary,
              resultSummary: row.resultSummary ?? null,
              decidedPath: row.decidedPath ?? null,
          }

/** One shift row (also a "my shift" row, which only adds its check-in flag). */
export const toShiftView = (row: ShiftType): ShiftsShiftView => ({
    id: row.id,
    date: row.date,
    start: hhmm(row.start),
    end: hhmm(row.end),
    positionId: row.positionId,
    staffId: row.staffId ?? null,
    status: row.status,
})

/** One availability window. */
export const toAvailView = (row: ShiftsAvailType): ShiftsAvailView => ({
    staffId: row.staffId,
    weekday: row.weekday ?? null,
    date: row.date ?? null,
    start: hhmm(row.start),
    end: hhmm(row.end),
    available: row.available,
})

/** One availability row with its note and approval state. */
export const toAvailRowView = (row: ShiftsAvailabilityType): ShiftsAvailRowView => ({
    ...toAvailView(row),
    id: row.id,
    note: row.note,
    status: row.status,
    createdAt: row.createdAt,
})

/** One leave request. */
export const toLeaveRowView = (row: ShiftsLeaveType): ShiftsLeaveRowView => ({
    id: row.id,
    staffId: row.staffId,
    from: row.from,
    to: row.to,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt,
    item: toWorkItemView(row.item),
})

/** One swap or open-shift claim. */
export const toSwapRowView = (row: ShiftsSwapType): ShiftsSwapRowView => ({
    id: row.id,
    kind: row.kind,
    shiftId: row.shiftId,
    fromStaffId: row.fromStaffId ?? null,
    toStaffId: row.toStaffId,
    reason: row.reason,
    status: row.status,
    checks: flat(row.checks),
    createdAt: row.createdAt,
    item: toWorkItemView(row.item),
    shiftLine: row.shiftLine,
})

const toPosition = (row: ShiftPositionType): ShiftsPositionView => ({ id: row.id, name: row.name, color: row.color })

const toStaff = (row: ShiftStaffType): ShiftsStaffView => ({
    id: row.id,
    name: row.name,
    positionIds: flat(row.positionIds),
    wage: row.wage,
    maxWeek: row.maxWeek,
    maxDay: row.maxDay,
    minRest: row.minRest,
    staffRowId: row.staffRowId ?? null,
    telegramChatId: row.telegramChatId ?? null,
    zaloUserId: row.zaloUserId ?? null,
    phone: row.phone ?? null,
    active: row.active,
})

const toBlock = (row: ShiftsBlockType): ShiftsBlockView => ({
    id: row.id,
    weekday: row.weekday,
    start: hhmm(row.start),
    end: hhmm(row.end),
    positionId: row.positionId,
    min: row.min,
    ideal: row.ideal,
    peak: row.peak,
})

const toSettings = (row: ShiftsSettingsType): ShiftsSettingsView => ({
    openingHours: Object.fromEntries(
        flat(row.openingHours).map((day) => [String(day.weekday), { open: day.open, close: day.close }]),
    ),
    swapNoticeHours: row.swapNoticeHours,
    leaveNoticeDays: row.leaveNoticeDays,
    remindMinutes: row.remindMinutes,
    noshowMinutes: row.noshowMinutes,
    overtimeHoursWeek: row.overtimeHoursWeek,
})

/** Positions, staff, coverage blocks and rules of the shop. */
export const toSetupView = (row: ShiftsSetupType): ShiftsSetupView => ({
    positions: flat(row.positions).map(toPosition),
    staff: flat(row.staff).map(toStaff),
    blocks: flat(row.blocks).map(toBlock),
    settings: toSettings(row.settings),
})
