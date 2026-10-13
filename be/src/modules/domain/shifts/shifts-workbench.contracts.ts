import type { Avail, Leave, Seg, Setup, Shift } from "./shifts.contracts"

/** A decision the workbench shows next to a request or a schedule. */
export interface ShiftsWorkItemView {
    /** The decision id. */
    readonly id: string
    /** Its status. */
    readonly status: string
    /** One line saying what it asks. */
    readonly summary: string
    /** What came of it, when it ran. */
    readonly resultSummary: string | null
    /** How it was decided. */
    readonly decidedPath: string | null
}

/** One version of a week, header only. */
export interface ShiftsScheduleVersionView {
    /** The schedule id. */
    readonly id: string
    /** The version number. */
    readonly version: number
    /** draft, published or superseded. */
    readonly status: string
    /** The estimated wage cost. */
    readonly costVnd: number
    /** When it was made. */
    readonly createdAt: string
    /** When it was published. */
    readonly publishedAt: string | null
}

/** One schedule in full. */
export interface ShiftsScheduleView extends ShiftsScheduleVersionView {
    /** The Monday of the week. */
    readonly weekStart: string
    /** solver or manual. */
    readonly source: string
    /** The written explanation. */
    readonly explanation: string
    /** How long the solver ran. */
    readonly solverMs: number | null
    /** Coverage and hours counts. */
    readonly summary: Record<string, unknown>
    /** What the solver and the checks found. */
    readonly evidence: Record<string, unknown>
    /** The publish decision. */
    readonly workItemId: string | null
}

/** A check-in of one shift. */
export interface ShiftsCheckinView {
    /** The shift. */
    readonly shiftId: string
    /** When the person checked in. */
    readonly checkedInAt: string
}

/** The work of one person on the day before the week, for the rest rule. */
export interface ShiftsPriorView {
    /** The person. */
    readonly staffId: string
    /** The pieces of work. */
    readonly segs: ReadonlyArray<Seg>
}

/** One week of the workbench. */
export interface ShiftsWeekView {
    /** The Monday shown. */
    readonly monday: string
    /** Every version of the week, newest first. */
    readonly versions: ReadonlyArray<ShiftsScheduleVersionView>
    /** The version people work with; staff see only a published one, without summary and evidence. */
    readonly current: ShiftsScheduleView | null
    /** The shifts of the current version. */
    readonly shifts: ReadonlyArray<Shift>
    /** The publish decision of the current version. */
    readonly publishItem: ShiftsWorkItemView | null
    /** The check-ins of the shifts (managers only). */
    readonly checkins: ReadonlyArray<ShiftsCheckinView>
    /** Approved availability of everyone. */
    readonly approvedAvail: ReadonlyArray<Avail>
    /** Approved leave of everyone. */
    readonly approvedLeaves: ReadonlyArray<Leave>
    /** The work of the day before the week. */
    readonly prior: ReadonlyArray<ShiftsPriorView>
}

/** One leave request. */
export interface ShiftsLeaveView {
    /** The request id. */
    readonly id: string
    /** The person. */
    readonly staffId: string
    /** The first day. */
    readonly from: string
    /** The last day. */
    readonly to: string
    /** The reason. */
    readonly reason: string
    /** pending, approved or declined. */
    readonly status: string
    /** The decision it waits on. */
    readonly workItemId: string | null
    /** When it was filed. */
    readonly createdAt: string
    /** The decision, when there is one. */
    readonly item: ShiftsWorkItemView | null
}

/** One swap or claim request. */
export interface ShiftsSwapView {
    /** The request id. */
    readonly id: string
    /** swap or claim. */
    readonly kind: string
    /** The shift. */
    readonly shiftId: string
    /** Who offers the shift; null for a claim. */
    readonly fromStaffId: string | null
    /** Who takes the shift. */
    readonly toStaffId: string
    /** The reason. */
    readonly reason: string
    /** pending, approved or declined. */
    readonly status: string
    /** The rule findings at decision time. */
    readonly checks: ReadonlyArray<string>
    /** The decision it waits on. */
    readonly workItemId: string | null
    /** When it was filed. */
    readonly createdAt: string
    /** The decision, when there is one. */
    readonly item: ShiftsWorkItemView | null
    /** One line describing the shift. */
    readonly shiftLine: string
}

/** One availability statement with its state. */
export interface ShiftsAvailabilityView {
    /** The statement id. */
    readonly id: string
    /** The person. */
    readonly staffId: string
    /** The weekday of a recurring statement (0 Monday to 6 Sunday). */
    readonly weekday: number | null
    /** The date of a one-day statement. */
    readonly date: string | null
    /** The window start, HH:MM. */
    readonly start: string
    /** The window end, HH:MM. */
    readonly end: string
    /** True when the person can work. */
    readonly available: boolean
    /** A free note. */
    readonly note: string
    /** pending, approved or declined. */
    readonly status: string
    /** When it was filed. */
    readonly createdAt: string
}

/** The requests of the workbench. */
export interface ShiftsRequestsView {
    /** The leave requests. */
    readonly leaves: ReadonlyArray<ShiftsLeaveView>
    /** The swap and claim requests. */
    readonly swaps: ReadonlyArray<ShiftsSwapView>
    /** The availability statements. */
    readonly availability: ReadonlyArray<ShiftsAvailabilityView>
}

/** The four ribbon figures of the workbench. */
export interface ShiftsFiguresView {
    /** Shifts of this week's current schedule that have a person. */
    readonly weekFilled: number
    /** Shifts of this week's current schedule in all. */
    readonly weekTotal: number
    /** Whether the week has a schedule at all. */
    readonly weekHasSchedule: boolean
    /** Published shifts in the next two weeks nobody has. */
    readonly openGaps: number
    /** Leave requests waiting for the manager. */
    readonly leavePending: number
    /** Scheduled hours of this month. */
    readonly hoursMonth: number
}

/** A shop staff row not yet linked to a shifts profile. */
export interface ShiftsStaffRowView {
    /** The staff row id. */
    readonly id: string
    /** The person's name. */
    readonly name: string
}

/** The whole shifts workbench. */
export interface ShiftsBenchView {
    /** The caller's role. */
    readonly role: string
    /** Today, Vietnam calendar. */
    readonly today: string
    /** The setup of the shop; pay only for managers. */
    readonly setup: Setup
    /** The caller's own shifts profile, when linked. */
    readonly myProfileId: string | null
    /** Whether the shift reminder pipeline is on. */
    readonly reminderOn: boolean
    /** The week shown. */
    readonly week: ShiftsWeekView
    /** The requests. */
    readonly requests: ShiftsRequestsView
    /** Shop staff rows for the link choice; managers only. */
    readonly staffRows: ReadonlyArray<ShiftsStaffRowView>
    /** Every availability statement; managers only. */
    readonly allAvailability: ReadonlyArray<ShiftsAvailabilityView>
    /** The ribbon figures; managers only. */
    readonly figures: ShiftsFiguresView | null
}

/** A shift of the member's own view, with its check-in flag. */
export interface ShiftsMyShiftView extends Shift {
    /** Whether the person checked in. */
    readonly checkedIn: boolean
}

/** A colleague the member may swap with. */
export interface ShiftsColleagueView {
    /** The profile id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The positions they work. */
    readonly positionIds: ReadonlyArray<string>
}

/** The signed-in person's own schedule view. */
export interface ShiftsMineView {
    /** The caller's own shifts profile, when linked. */
    readonly profileId: string | null
    /** Today, Vietnam calendar. */
    readonly today: string
    /** Their shifts of the next two weeks. */
    readonly myShifts: ReadonlyArray<ShiftsMyShiftView>
    /** Open shifts they may ask for. */
    readonly openShifts: ReadonlyArray<Shift>
    /** The colleagues they may swap with. */
    readonly colleagues: ReadonlyArray<ShiftsColleagueView>
    /** Their availability statements. */
    readonly availability: ReadonlyArray<ShiftsAvailabilityView>
    /** Their leave requests. */
    readonly leaves: ReadonlyArray<ShiftsLeaveView>
    /** Their swap and claim requests. */
    readonly swaps: ReadonlyArray<ShiftsSwapView>
}
