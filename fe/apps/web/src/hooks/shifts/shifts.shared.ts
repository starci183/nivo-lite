import type {
    ShiftsBenchType,
    ShiftsFiguresType,
    ShiftsMineType,
    ShiftsPriorType,
    ShiftsScheduleType,
    ShiftsWeekType,
} from "@/modules/api"
import type {
    ShiftsBenchView,
    ShiftsFiguresView,
    ShiftsMineView,
    ShiftsScheduleView,
    ShiftsSegView,
    ShiftsWeekView,
} from "@/modules/types"
import {
    flat,
    toAvailRowView,
    toAvailView,
    toLeaveRowView,
    toSetupView,
    toShiftView,
    toSwapRowView,
    toWorkItemView,
} from "@/hooks/shiftsWire"

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** How the explanation of a schedule was written ("openclaw" or the automatic summary), read from the schedule evidence. */
const explanationSourceOf = (evidence: unknown): string => {
    if (!isRecord(evidence) || !isRecord(evidence.explanation)) return ""
    return typeof evidence.explanation.source === "string" ? evidence.explanation.source : ""
}

const toSchedule = (row: ShiftsScheduleType): ShiftsScheduleView => ({
    id: row.id,
    version: row.version,
    status: row.status,
    explanation: row.explanation,
    explanationSource: explanationSourceOf(row.evidence),
})

const toPrior = (rows: ReadonlyArray<ReadonlyArray<ShiftsPriorType>>): Record<string, ReadonlyArray<ShiftsSegView>> =>
    Object.fromEntries(
        flat(rows).map((row) => [
            row.staffId,
            flat(row.segs).map((seg) => ({ date: seg.date, s: seg.s, e: seg.e, pos: seg.pos })),
        ]),
    )

const toWeek = (row: ShiftsWeekType): ShiftsWeekView => ({
    monday: row.monday,
    current: row.current === null || row.current === undefined ? null : toSchedule(row.current),
    shifts: flat(row.shifts).map(toShiftView),
    publishItem: toWorkItemView(row.publishItem),
    approvedAvail: flat(row.approvedAvail).map(toAvailView),
    approvedLeaves: flat(row.approvedLeaves).map((leave) => ({
        staffId: leave.staffId,
        from: leave.from,
        to: leave.to,
    })),
    prior: toPrior(row.prior),
})

/** The `shiftsWorkbench` answer as the view the panels render. */
export const toBenchView = (row: ShiftsBenchType): ShiftsBenchView => ({
    role: row.role,
    today: row.today,
    setup: toSetupView(row.setup),
    myProfileId: row.myProfileId ?? null,
    reminderOn: row.reminderOn,
    week: toWeek(row.week),
    requests: {
        leaves: flat(row.requests.leaves).map(toLeaveRowView),
        swaps: flat(row.requests.swaps).map(toSwapRowView),
        availability: flat(row.requests.availability).map(toAvailRowView),
    },
    staffRows: flat(row.staffRows).map((staff) => ({ id: staff.id, name: staff.name })),
    allAvailability: flat(row.allAvailability).map(toAvailRowView),
})

/** The `shiftsMine` answer as the view of the signed-in person. */
export const toMineView = (row: ShiftsMineType): ShiftsMineView => ({
    profileId: row.profileId ?? null,
    today: row.today,
    myShifts: flat(row.myShifts).map((shift) => ({ ...toShiftView(shift), checkedIn: shift.checkedIn })),
    openShifts: flat(row.openShifts).map(toShiftView),
    colleagues: flat(row.colleagues).map((person) => ({
        id: person.id,
        name: person.name,
        positionIds: flat(person.positionIds),
    })),
    availability: flat(row.availability).map(toAvailRowView),
    leaves: flat(row.leaves).map(toLeaveRowView),
    swaps: flat(row.swaps).map(toSwapRowView),
})

/** The wire figures as the ribbon's view. */
export const toFiguresView = (row: ShiftsFiguresType): ShiftsFiguresView => ({
    weekFilled: row.weekFilled,
    weekTotal: row.weekTotal,
    weekHasSchedule: row.weekHasSchedule,
    openGaps: row.openGaps,
    leavePending: row.leavePending,
    hoursMonth: row.hoursMonth,
})

/** The badge a request state is shown with: its tone and the key of its word in the `shifts` messages. */
interface RequestStatusView {
    readonly tone: "success" | "neutral" | "warning"
    readonly key: "stApproved" | "stDeclined" | "stPending"
}

/** The badge of a leave, swap or availability request by its status (anything not decided is pending). */
export const requestStatusOf = (status: string): RequestStatusView => {
    if (status === "approved") return { tone: "success", key: "stApproved" }
    if (status === "declined") return { tone: "neutral", key: "stDeclined" }
    return { tone: "warning", key: "stPending" }
}
