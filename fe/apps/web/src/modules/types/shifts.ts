/** One role of the shop (barista, waiter, cashier) with the colour it is drawn in. */
export interface ShiftsPositionView {
    readonly id: string
    readonly name: string
    readonly color: string
}

/** One person on the roster with the limits the rules check and the channels the staff messages go to. */
export interface ShiftsStaffView {
    readonly id: string
    readonly name: string
    readonly positionIds: ReadonlyArray<string>
    readonly wage: number
    readonly maxWeek: number
    readonly maxDay: number
    readonly minRest: number
    readonly staffRowId: string | null
    readonly telegramChatId: string | null
    readonly zaloUserId: string | null
    readonly phone: string | null
    readonly active: boolean
}

/** One coverage block: how many people one position needs on one weekday between two times. */
export interface ShiftsBlockView {
    readonly id: string
    readonly weekday: number
    readonly start: string
    readonly end: string
    readonly positionId: string
    readonly min: number
    readonly ideal: number
    readonly peak: boolean
}

/** The shop rules and the opening hours by weekday (0 = Monday); a closed day is `null`. */
export interface ShiftsSettingsView {
    readonly openingHours: Readonly<Record<string, { readonly open: string; readonly close: string } | null>>
    readonly swapNoticeHours: number
    readonly leaveNoticeDays: number
    readonly remindMinutes: number
    readonly noshowMinutes: number
    readonly overtimeHoursWeek: number
}

/** Everything a manager sets up: positions, staff, coverage blocks and rules. */
export interface ShiftsSetupView {
    readonly positions: ReadonlyArray<ShiftsPositionView>
    readonly staff: ReadonlyArray<ShiftsStaffView>
    readonly blocks: ReadonlyArray<ShiftsBlockView>
    readonly settings: ShiftsSettingsView
}

/** One shift of a schedule; `staffId` is `null` for an open shift. */
export interface ShiftsShiftView {
    readonly id: string
    readonly date: string
    readonly start: string
    readonly end: string
    readonly positionId: string
    readonly staffId: string | null
    readonly status: string
}

/** A window in which a person can (or cannot) work, by weekday or by one date. */
export interface ShiftsAvailView {
    readonly staffId: string
    readonly weekday: number | null
    readonly date: string | null
    readonly start: string
    readonly end: string
    readonly available: boolean
}

/** An availability row as stored: the window plus its note and approval state. */
export interface ShiftsAvailRowView extends ShiftsAvailView {
    readonly id: string
    readonly note: string
    readonly status: string
    readonly createdAt: string
}

/** The days one person is away. */
export interface ShiftsLeaveSpanView {
    readonly staffId: string
    readonly from: string
    readonly to: string
}

/** One continuous piece of work of one person, in minutes of its date. */
export interface ShiftsSegView {
    readonly date: string
    readonly s: number
    readonly e: number
    readonly pos: string
}

/** The agent work item behind a request (approve / decline buttons, the one-line summary). */
export interface ShiftsWorkItemView {
    readonly id: string
    readonly status: string
    readonly summary: string
    readonly resultSummary: string | null
    readonly decidedPath: string | null
}

/** A leave request with the work item that carries its decision. */
export interface ShiftsLeaveRowView {
    readonly id: string
    readonly staffId: string
    readonly from: string
    readonly to: string
    readonly reason: string
    readonly status: string
    readonly createdAt: string
    readonly item: ShiftsWorkItemView | null
}

/** A swap or open-shift claim with the rule findings and the work item that carries its decision. */
export interface ShiftsSwapRowView {
    readonly id: string
    readonly kind: string
    readonly shiftId: string
    readonly fromStaffId: string | null
    readonly toStaffId: string
    readonly reason: string
    readonly status: string
    readonly checks: ReadonlyArray<string>
    readonly createdAt: string
    readonly item: ShiftsWorkItemView | null
    readonly shiftLine: string
}

/** The schedule version shown for a week and how its explanation was written. */
export interface ShiftsScheduleView {
    readonly id: string
    readonly version: number
    readonly status: string
    readonly explanation: string
    readonly explanationSource: string
}

/** One week: its schedule, shifts and the facts the live rule checks need. */
export interface ShiftsWeekView {
    readonly monday: string
    readonly current: ShiftsScheduleView | null
    readonly shifts: ReadonlyArray<ShiftsShiftView>
    readonly publishItem: ShiftsWorkItemView | null
    readonly approvedAvail: ReadonlyArray<ShiftsAvailView>
    readonly approvedLeaves: ReadonlyArray<ShiftsLeaveSpanView>
    readonly prior: Readonly<Record<string, ReadonlyArray<ShiftsSegView>>>
}

/** The open requests of the shop. */
export interface ShiftsRequestsView {
    readonly leaves: ReadonlyArray<ShiftsLeaveRowView>
    readonly swaps: ReadonlyArray<ShiftsSwapRowView>
    readonly availability: ReadonlyArray<ShiftsAvailRowView>
}

/** What the manager workbench reads: setup, the chosen week and the requests. */
export interface ShiftsBenchView {
    readonly role: string
    readonly today: string
    readonly setup: ShiftsSetupView
    readonly myProfileId: string | null
    readonly reminderOn: boolean
    readonly week: ShiftsWeekView
    readonly requests: ShiftsRequestsView
    readonly staffRows: ReadonlyArray<{ readonly id: string; readonly name: string }>
    readonly allAvailability: ReadonlyArray<ShiftsAvailRowView>
}

/** One shift of the signed-in person with their check-in state. */
export interface ShiftsMyShiftView extends ShiftsShiftView {
    readonly checkedIn: boolean
}

/** What the "my schedule" view reads for one person. */
export interface ShiftsMineView {
    readonly profileId: string | null
    readonly today: string
    readonly myShifts: ReadonlyArray<ShiftsMyShiftView>
    readonly openShifts: ReadonlyArray<ShiftsShiftView>
    readonly colleagues: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly positionIds: ReadonlyArray<string>
    }>
    readonly availability: ReadonlyArray<ShiftsAvailRowView>
    readonly leaves: ReadonlyArray<ShiftsLeaveRowView>
    readonly swaps: ReadonlyArray<ShiftsSwapRowView>
}

/** The ribbon's four figures of the agent dashboard frame. */
export interface ShiftsFiguresView {
    readonly weekFilled: number
    readonly weekTotal: number
    readonly weekHasSchedule: boolean
    readonly openGaps: number
    readonly leavePending: number
    readonly hoursMonth: number
}
