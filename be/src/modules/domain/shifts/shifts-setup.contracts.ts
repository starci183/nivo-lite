/** What the request to create or update one position takes. */
export interface SavePositionParams {
    /** The position to update; absent creates one. */
    readonly id?: string
    /** The position name. */
    readonly name: string
    /** The colour the grid draws it in; absent picks the default. */
    readonly color?: string
}

/** What the request to save a position answers. */
export interface SavePositionOutput {
    /** The position id. */
    readonly id: string
}

/** What the request to retire a position takes. */
export interface RemovePositionParams {
    /** The position. */
    readonly id: string
}

/** What the request to create or update one person's shifts profile takes. */
export interface SaveStaffParams {
    /** The profile to update; absent creates one. */
    readonly id?: string
    /** The person's name. */
    readonly name: string
    /** The positions they can work. */
    readonly positionIds: ReadonlyArray<string>
    /** The hourly wage in dong; absent keeps or writes zero. */
    readonly wage?: number
    /** The most hours a week. */
    readonly maxWeek?: number
    /** The most hours a day. */
    readonly maxDay?: number
    /** The fewest hours of rest between days. */
    readonly minRest?: number
    /** The shop's staff row this profile links to. */
    readonly staffRowId?: string | null
    /** The phone number. */
    readonly phone?: string
    /** The Telegram chat shift messages also go to. */
    readonly telegramChatId?: string
    /** The Zalo user shift messages also go to. */
    readonly zaloUserId?: string
    /** False once the person has left. */
    readonly active?: boolean
}

/** What the request to save a profile answers. */
export interface SaveStaffOutput {
    /** The profile id. */
    readonly id: string
}

/** What the request to create or update coverage takes. */
export interface SaveCoverageParams {
    /** The block to update; absent creates one per weekday. */
    readonly id?: string
    /** The weekdays covered (0 Monday to 6 Sunday). */
    readonly weekdays: ReadonlyArray<number>
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
    /** True for a busy window. */
    readonly peak: boolean
}

/** What the request to remove a coverage block takes. */
export interface RemoveCoverageParams {
    /** The block. */
    readonly id: string
}

/** The opening hours of one weekday. */
export interface OpeningHoursInput {
    /** The weekday, 0 Monday to 6 Sunday. */
    readonly weekday: number
    /** The opening time, HH:MM. */
    readonly open: string
    /** The closing time, HH:MM. */
    readonly close: string
}

/** What the request to save the rules takes. */
export interface SaveShiftsSettingsParams {
    /** Hours of notice a swap needs. */
    readonly swapNoticeHours: number
    /** Days of notice a leave needs. */
    readonly leaveNoticeDays: number
    /** Minutes before a shift the reminder goes out. */
    readonly remindMinutes: number
    /** Minutes after the start a no-show is reported. */
    readonly noshowMinutes: number
    /** Hours per week after which work is paid at +50%. */
    readonly overtimeHoursWeek: number
    /** The opening hours by weekday; a day absent is closed. */
    readonly openingHours: ReadonlyArray<OpeningHoursInput>
}

/** What the request to add an availability statement takes. */
export interface SaveShiftsAvailabilityParams {
    /** The person; the manager's statements approve at once, a member's own wait for approval. */
    readonly staffId?: string
    /** The weekday of a recurring statement; null with `date`. */
    readonly weekday: number | null
    /** The date of a one-day statement; null with `weekday`. */
    readonly date: string | null
    /** The window start, HH:MM. */
    readonly start: string
    /** The window end, HH:MM. */
    readonly end: string
    /** True when the person can work in the window. */
    readonly available: boolean
    /** A free note. */
    readonly note?: string
}

/** What saving an availability statement answers. */
export interface SaveShiftsAvailabilityOutput {
    /** The statement id. */
    readonly id: string
}

/** What the request to remove an availability statement takes. */
export interface RemoveAvailabilityParams {
    /** The statement. */
    readonly id: string
}

/** What the request to decide a pending availability statement takes. */
export interface DecideAvailabilityParams {
    /** The statement. */
    readonly id: string
    /** Whether to approve it. */
    readonly approve: boolean
}

/** What the request to check in to a shift takes. */
export interface CheckInParams {
    /** The shift. */
    readonly shiftId: string
}

/** What checking in answers. */
export interface CheckInOutput {
    /** When the check-in was recorded. */
    readonly at: string
}
