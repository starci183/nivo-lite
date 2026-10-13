/** A role in the shop that coverage is counted for, for example barista or cashier. */
export interface ShiftPosition {
    /** The position id. */
    readonly id: string
    /** The position name. */
    readonly name: string
    /** The colour the grid draws the position in, as a CSS colour. */
    readonly color: string
}

/** One person who can be scheduled, with the limits the rules enforce. */
export interface ShiftStaff {
    /** The shifts profile id. */
    readonly id: string
    /** The person's name. */
    readonly name: string
    /** The positions this person can work. */
    readonly positionIds: ReadonlyArray<string>
    /** Free-form skills. */
    readonly skills: ReadonlyArray<string>
    /** The hourly wage in dong; zero when the caller may not read pay. */
    readonly wage: number
    /** The most hours the person works in a week. */
    readonly maxWeek: number
    /** The most hours the person works in a day. */
    readonly maxDay: number
    /** The fewest hours of rest between two working days. */
    readonly minRest: number
    /** The shop's staff row (the Office handle) this profile is linked to. */
    readonly staffRowId: string | null
    /** The Telegram chat shift messages also go to. */
    readonly telegramChatId: string | null
    /** The Zalo user shift messages also go to. */
    readonly zaloUserId: string | null
    /** The phone number. */
    readonly phone: string | null
    /** False once the person has left. */
    readonly active: boolean
}

/** A statement of when a person can or cannot work: recurring by weekday, or one date. */
export interface Avail {
    /** The person. */
    readonly staffId: string
    /** The weekday (0 Monday to 6 Sunday) of a recurring statement; null for a date. */
    readonly weekday: number | null
    /** The date of a one-day statement; null for a recurring one. */
    readonly date: string | null
    /** The window start, HH:MM. */
    readonly start: string
    /** The window end, HH:MM. */
    readonly end: string
    /** True when the person can work in the window, false when they cannot. */
    readonly available: boolean
}

/** How many people one position needs in a time window of a weekday. */
export interface Block {
    /** The coverage row id. */
    readonly id: string
    /** The weekday, 0 Monday to 6 Sunday. */
    readonly weekday: number
    /** The window start, HH:MM. */
    readonly start: string
    /** The window end, HH:MM. */
    readonly end: string
    /** The position. */
    readonly positionId: string
    /** The fewest people needed. */
    readonly min: number
    /** The ideal number of people. */
    readonly ideal: number
    /** True for a busy window that is filled up to the ideal first. */
    readonly peak: boolean
}

/** Approved leave of one person. */
export interface Leave {
    /** The person. */
    readonly staffId: string
    /** The first day of leave. */
    readonly from: string
    /** The last day of leave. */
    readonly to: string
}

/** One shift; an open shift has no person. */
export interface Shift {
    /** The shift id. */
    readonly id: string
    /** The day, YYYY-MM-DD. */
    readonly date: string
    /** The start, HH:MM. */
    readonly start: string
    /** The end, HH:MM. */
    readonly end: string
    /** The position worked. */
    readonly positionId: string
    /** The person, or null for an open shift. */
    readonly staffId: string | null
    /** draft, published, swapped or cancelled. */
    readonly status: string
}

/** One continuous piece of work of one person, in minutes of its day. */
export interface Seg {
    /** The day, YYYY-MM-DD. */
    readonly date: string
    /** The start minute. */
    readonly s: number
    /** The end minute. */
    readonly e: number
    /** The position worked. */
    readonly pos: string
}

/** What the rules run against. */
export interface Env {
    /** The people by id. */
    readonly staff: ReadonlyMap<string, ShiftStaff>
    /** Approved availability statements. */
    readonly avail: ReadonlyArray<Avail>
    /** Approved leave. */
    readonly leaves: ReadonlyArray<Leave>
    /** The work of the day just before the week, for the rest rule across the week boundary. */
    readonly prior?: ReadonlyMap<string, ReadonlyArray<Seg>>
    /** Hours per week after which work is paid at +50%. */
    readonly overtimeHoursWeek: number
}

/** The rules a piece of work can break. */
export type ViolationKind = "overlap" | "unavailable" | "leave" | "max_day" | "max_week" | "rest" | "position"

/** One broken rule. */
export interface Violation {
    /** Which rule. */
    readonly kind: ViolationKind
    /** The measured value (hours) or the rule name. */
    readonly detail: string
}

/** Whether a coverage window has too few, enough or too many people. */
export type CoverageStatus = "short" | "ok" | "over"

/** How well one coverage block of one day is staffed. */
export interface CoverageCell {
    /** The coverage row. */
    readonly blockId: string
    /** The day. */
    readonly date: string
    /** The position. */
    readonly positionId: string
    /** The window start. */
    readonly start: string
    /** The window end. */
    readonly end: string
    /** The fewest people needed. */
    readonly min: number
    /** The ideal number of people. */
    readonly ideal: number
    /** True for a peak window. */
    readonly peak: boolean
    /** The fewest people on duty at any moment of the window. */
    readonly have: number
    /** short, ok or over. */
    readonly status: CoverageStatus
}

/** A coverage window the solver could not fill. */
export interface Shortage {
    /** The coverage row. */
    readonly blockId: string
    /** The day. */
    readonly date: string
    /** The position. */
    readonly positionId: string
    /** The window start. */
    readonly start: string
    /** The window end. */
    readonly end: string
    /** How many people are missing. */
    readonly missing: number
}

/** Why a person who could cover a shortage was not scheduled. */
export type AskReason = "unavailable" | "over_hours" | "rest" | "other"

/** A person worth asking to cover a shortage. */
export interface AskCandidate {
    /** The coverage row. */
    readonly blockId: string
    /** The day. */
    readonly date: string
    /** The person. */
    readonly staffId: string
    /** Why they were not scheduled. */
    readonly why: AskReason
}

/** What the solver reports about its run. */
export interface SolverReport {
    /** How long it ran, in milliseconds. */
    readonly ms: number
    /** How many starts it tried. */
    readonly iterations: number
    /** The estimated wage cost of the week. */
    readonly costVnd: number
    /** The shifts that have a person. */
    readonly shiftCount: number
    /** The open shifts nobody could cover. */
    readonly openCount: number
    /** The unfilled windows. */
    readonly shortages: ReadonlyArray<Shortage>
    /** The hours of every scheduled person. */
    readonly hoursByStaff: ReadonlyArray<StaffHours>
    /** People who could cover a shortage if asked: suggestions for the owner, never applied. */
    readonly askCandidates: ReadonlyArray<AskCandidate>
}

/** The hours one person works in a week. */
export interface StaffHours {
    /** The person. */
    readonly staffId: string
    /** The hours, one decimal. */
    readonly hours: number
}

/** What the solver is asked to solve. */
export interface SolveInput {
    /** The Monday of the week. */
    readonly monday: string
    /** The people. */
    readonly staff: ReadonlyArray<ShiftStaff>
    /** The coverage blocks. */
    readonly blocks: ReadonlyArray<Block>
    /** Approved availability. */
    readonly avail: ReadonlyArray<Avail>
    /** Approved leave. */
    readonly leaves: ReadonlyArray<Leave>
    /** The work of the day before the week. */
    readonly prior: ReadonlyMap<string, ReadonlyArray<Seg>>
    /** Hours per week after which work is paid at +50%. */
    readonly overtimeHoursWeek: number
    /** The clock in milliseconds, so the run time is measured and capped without reading the ambient clock. */
    readonly nowMs: () => number
    /** How long the solver may keep trying other starts, in milliseconds. */
    readonly budgetMs: number
    /** The most starts it tries. */
    readonly starts: number
}

/** The solved week. */
export interface SolveOutput {
    /** The shifts, with people and open ones. */
    readonly shifts: ReadonlyArray<Shift>
    /** What the run found. */
    readonly report: SolverReport
}

/** The rules and hours of the shop. */
export interface ShiftsSettings {
    /** The opening hours by weekday (0 Monday to 6 Sunday); a closed day is absent. */
    readonly openingHours: ReadonlyArray<OpeningDay>
    /** Hours of notice a swap needs before the shift. */
    readonly swapNoticeHours: number
    /** Days of notice a leave request needs. */
    readonly leaveNoticeDays: number
    /** Minutes before a shift the reminder goes out. */
    readonly remindMinutes: number
    /** Minutes after a shift started the owner is told nobody checked in. */
    readonly noshowMinutes: number
    /** Hours per week after which work is paid at +50%. */
    readonly overtimeHoursWeek: number
}

/** The opening hours of one weekday. */
export interface OpeningDay {
    /** The weekday, 0 Monday to 6 Sunday. */
    readonly weekday: number
    /** The opening time, HH:MM. */
    readonly open: string
    /** The closing time, HH:MM. */
    readonly close: string
}

/** The shop's setup: positions, people, coverage and rules. */
export interface Setup {
    /** The active positions. */
    readonly positions: ReadonlyArray<ShiftPosition>
    /** Everyone ever added, active or not. */
    readonly staff: ReadonlyArray<ShiftStaff>
    /** The coverage blocks. */
    readonly blocks: ReadonlyArray<Block>
    /** The rules. */
    readonly settings: ShiftsSettings
}

/** One piece of the shop-local wall clock. */
export interface WallClock {
    /** The day, YYYY-MM-DD. */
    readonly date: string
    /** The minute of the day. */
    readonly minute: number
}

/** What a tick found due for one shift. */
export interface ShiftDue {
    /** The shift. */
    readonly shift: Shift
    /** The workspace. */
    readonly workspaceId: string
    /** Minutes before the start the reminder is due. */
    readonly remindMinutes: number
    /** Minutes after the start the no-show alert is due. */
    readonly noshowMinutes: number
}

/** One person's month of work. */
export interface MonthRow {
    /** The person's name. */
    readonly name: string
    /** The shifts worked. */
    readonly shifts: number
    /** The scheduled hours. */
    readonly hours: number
    /** The hours of shifts the person checked in to. */
    readonly checked: number
    /** The hourly wage. */
    readonly wage: number
    /** Scheduled hours times wage. */
    readonly cost: number
}

/** A month of work for the whole shop. */
export interface MonthSummary {
    /** One row per person who worked. */
    readonly rows: ReadonlyArray<MonthRow>
    /** The wage total. */
    readonly total: number
    /** The hours total. */
    readonly hours: number
}

/** The first and last day of a month. */
export interface MonthBounds {
    /** The first day. */
    readonly from: string
    /** The last day. */
    readonly to: string
}

/** One finding of a swap or claim check, rendered to text by the caller. */
export interface SwapFinding {
    /** The message key suffix under `shifts.swap.`. */
    readonly code: string
    /** The values the text needs. */
    readonly params: Readonly<Record<string, string | number>>
}
