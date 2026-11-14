/** The statuses a booking moves through: asked by the customer, confirmed by the shop, cancelled, or served. */
export const BOOKING_STATUSES: readonly ["requested", "confirmed", "cancelled", "done"] = [
    "requested",
    "confirmed",
    "cancelled",
    "done",
]

/** One status of a booking. */
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/** What a resource is: a person (who may be a member of the staff directory) or a room. */
export const RESOURCE_KINDS: readonly ["person", "room"] = ["person", "room"]

/** The statuses of a booking that holds its resource: one still ahead of the customer. */
export const HOLDING_STATUSES: ReadonlyArray<string> = ["requested", "confirmed"]

/** Whether a booking of this status holds its resource. */
export const holdsResource = (status: string): boolean => HOLDING_STATUSES.includes(status)

/** The calendar rules a workspace starts with: a start every 30 minutes, booked at least an hour ahead, at most 60 days ahead, reminded a day before. */
export const BOOKING_RULE_DEFAULTS = {
    slotStepMin: 30,
    minLeadMin: 60,
    maxAdvanceDays: 60,
    remindHoursBefore: 24,
} as const

/** What the reminder rule reads of a booking. */
export interface RemindCandidate {
    /** The status. */
    readonly status: string
    /** The start instant. */
    readonly startMs: number
    /** When the reminder went out, or null. */
    readonly remindedAt: string | null
}

/** Whether a booking is due its one reminder at `nowMs`: confirmed, not reminded yet, starting within `hoursBefore` hours and not started. */
export const reminderDue = (booking: RemindCandidate, nowMs: number, hoursBefore: number): boolean =>
    booking.status === "confirmed" &&
    booking.remindedAt === null &&
    booking.startMs > nowMs &&
    booking.startMs <= nowMs + hoursBefore * 3_600_000
