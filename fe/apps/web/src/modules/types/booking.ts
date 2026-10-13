/**
 * Plain data of the booking module: the calendar, its rules and its statistics, as the screens read them. No behaviour.
 */

/** The booking rules of a workspace, in the words the screens use. */
export interface BookingSettingsView {
    readonly timezone: string
    readonly slotStepMin: number
    readonly minLeadMin: number
    readonly maxAdvanceDays: number
    readonly cancelWindowHours: number
    readonly depositPct: number
    readonly lateCancelFeePct: number
    readonly noShowFeeVnd: number
    readonly autoConfirm: boolean
    readonly handoffOrder: boolean
    readonly address: string
    readonly publicEnabled: boolean
    readonly publicSlug: string | null
    readonly publicNote: string
}

/** A service the owner sells by appointment. */
export interface BookingServiceView {
    readonly id: string
    readonly name: string
    readonly description: string
    readonly durationMin: number
    readonly bufferMin: number
    readonly priceVnd: number | null
    readonly resourceKind: string | null
    readonly followupDays: number | null
    readonly active: boolean
}

/** A person, room or chair that serves customers. */
export interface BookingResourceView {
    readonly id: string
    readonly name: string
    readonly kind: string
    readonly capacity: number
    readonly color: string
    readonly active: boolean
    readonly staffId: string | null
}

/** A weekly opening window of one resource. */
export interface BookingHoursView {
    readonly resourceId: string
    readonly weekday: number
    readonly start: string
    readonly end: string
}

/** A closing or a different opening window on one date. */
export interface BookingExceptionView {
    readonly id: string
    readonly resourceId: string | null
    readonly date: string
    readonly closed: boolean
    readonly start: string | null
    readonly end: string | null
    readonly note: string
}

/** One booking placed on the wall clock of the business. */
export interface BookingView {
    readonly id: string
    readonly customer: string
    readonly phone: string | null
    readonly serviceId: string
    readonly service: string
    readonly resourceId: string
    readonly startMs: number
    readonly endMs: number
    /** The local date the booking starts on, `YYYY-MM-DD`. */
    readonly date: string
    /** The minutes since local midnight the booking starts. */
    readonly startMin: number
    /** The minutes since local midnight the booking ends; it never wraps past 24:00. */
    readonly endMin: number
    readonly startClock: string
    readonly endClock: string
    readonly status: string
    readonly holdsSlot: boolean
    readonly party: number
    readonly priceVnd: number | null
    readonly depositVnd: number
    readonly depositStatus: string
    readonly feeVnd: number
    readonly checkedIn: boolean
    readonly note: string
    readonly conflictNote: string
    readonly source: string
    readonly leadId: string | null
    readonly reschedules: number
}

/** A customer who waits for a free time. */
export interface BookingWaitView {
    readonly id: string
    readonly customer: string
    readonly phone: string | null
    readonly service: string
    readonly fromMs: number
    readonly toMs: number
    readonly party: number
    readonly status: string
}

/** A staff member a resource can be linked to. */
export interface BookingStaffView {
    readonly id: string
    readonly name: string
}

/** Everything the booking workbench reads for one range of dates. */
export interface BookingBoard {
    readonly timezone: string
    readonly today: string
    readonly nowMs: number
    readonly from: string
    readonly to: string
    readonly settings: BookingSettingsView
    readonly services: ReadonlyArray<BookingServiceView>
    readonly resources: ReadonlyArray<BookingResourceView>
    readonly hours: ReadonlyArray<BookingHoursView>
    readonly exceptions: ReadonlyArray<BookingExceptionView>
    readonly bookings: ReadonlyArray<BookingView>
    readonly waitlist: ReadonlyArray<BookingWaitView>
    readonly staff: ReadonlyArray<BookingStaffView>
    /** The figures of the ribbon: fixed windows, they do not move when the calendar pages to another week. */
    readonly figures: BookingFiguresView
    /** The statistics of the range. */
    readonly stats: BookingStatsView
}

/** The four figures of the booking ribbon. */
export interface BookingFiguresView {
    readonly bookingsToday: number
    readonly noShowPct30d: number | null
    readonly finished30d: number
    readonly utilisationPct: number | null
    readonly depositsPending: number
    readonly depositsPendingVnd: number
}

/** The utilisation of one resource over the range. */
export interface BookingResourceStatView {
    readonly resourceId: string
    readonly name: string
    readonly openMin: number
    readonly bookedMin: number
    readonly pct: number
}

/** The statistics of the range. */
export interface BookingStatsView {
    readonly byResource: ReadonlyArray<BookingResourceStatView>
    readonly byStatus: Readonly<Record<string, number>>
    readonly noShowPct: number
    readonly doneRevenueVnd: number
    readonly total: number
}

/** An action on a booking that changes its status. */
export type BookingAction = "confirm" | "check-in" | "done" | "no-show" | "cancel"

/** A service the public booking page offers. */
export interface PublicBookingService {
    readonly id: string
    readonly name: string
    readonly description: string
    readonly durationMin: number
    readonly priceVnd: number | null
}

/** The public booking page of one shop. */
export interface PublicBookingPageData {
    readonly shop: string
    readonly slug: string
    readonly note: string
    readonly address: string
    readonly timezone: string
    readonly services: ReadonlyArray<PublicBookingService>
}

/** The answer to a visitor's request: the code is a catalog key suffix (`code_<code>` of workbenchBooking). */
export interface PublicBookingAnswer {
    readonly ok: boolean
    readonly state: "confirmed" | "waiting" | "invalid" | "failed"
    readonly code: string
    readonly service: string
    readonly start: string
    readonly alternatives: ReadonlyArray<string>
    readonly bookingId: string | null
}
