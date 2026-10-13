import type {
    BookableService,
    BookingOverview,
    BookingResource,
    BookingSettings,
    DateException,
    WeeklyHours,
} from "./bookings.contracts"

/** The workspace and optional local dates the workbench reads. */
export interface BookingBoardParams {
    /** The workspace whose calendar is shown. */
    readonly workspaceId: string
    /** The first local date; the current Monday when omitted. */
    readonly from?: string
    /** The last local date; six days after the first when omitted. */
    readonly to?: string
}

/** A bookable service with the follow-up setting used by the setup form. */
export interface BookingBoardServiceItem extends BookableService {
    /** Days after a visit at which a follow-up is due, or null when disabled. */
    readonly followupDays: number | null
}

/** A calendar resource with its display colour and optional staff link. */
export interface BookingBoardResource extends BookingResource {
    /** The colour used on the calendar. */
    readonly color: string
    /** The linked staff member, or null. */
    readonly staffId: string | null
}

/** A named opening exception that the owner can edit or remove. */
export interface BookingBoardException extends DateException {
    /** The exception id. */
    readonly id: string
    /** The owner's note. */
    readonly note: string
}

/** One booking on the wall clock of the business. */
export interface BookingBoardEntry {
    /** The booking id. */
    readonly id: string
    /** The customer name. */
    readonly customer: string
    /** The customer phone, or null. */
    readonly phone: string | null
    /** The booked service id. */
    readonly serviceId: string
    /** The current service name. */
    readonly service: string
    /** The resource that serves the booking. */
    readonly resourceId: string
    /** The start instant in epoch milliseconds. */
    readonly startMs: number
    /** The visit end instant in epoch milliseconds. */
    readonly endMs: number
    /** The local date the booking starts on. */
    readonly date: string
    /** The minutes since local midnight the booking starts. */
    readonly startMin: number
    /** The minutes since local midnight the booking ends, capped at 24:00. */
    readonly endMin: number
    /** The local start time, HH:MM. */
    readonly startClock: string
    /** The local end time, HH:MM, or 24:00 for an overnight visit. */
    readonly endClock: string
    /** The booking lifecycle status. */
    readonly status: string
    /** Whether this booking holds capacity. */
    readonly holdsSlot: boolean
    /** The number of customers. */
    readonly party: number
    /** The visit price, in VND, or null. */
    readonly priceVnd: number | null
    /** The deposit amount, in VND. */
    readonly depositVnd: number
    /** The deposit lifecycle status. */
    readonly depositStatus: string
    /** The recorded cancellation or no-show fee, in VND. */
    readonly feeVnd: number
    /** Whether the customer has checked in. */
    readonly checkedIn: boolean
    /** The booking note. */
    readonly note: string
    /** The note explaining a forced placement. */
    readonly conflictNote: string
    /** The channel that created the booking. */
    readonly source: string
    /** The linked lead, or null. */
    readonly leadId: string | null
    /** The number of times this booking was moved. */
    readonly reschedules: number
}

/** A customer waiting for a free appointment. */
export interface BookingBoardWait {
    /** The waitlist entry id. */
    readonly id: string
    /** The customer name. */
    readonly customer: string
    /** The customer phone, or null. */
    readonly phone: string | null
    /** The current service name. */
    readonly service: string
    /** The beginning of the requested window in epoch milliseconds. */
    readonly fromMs: number
    /** The end of the requested window in epoch milliseconds. */
    readonly toMs: number
    /** The number of customers. */
    readonly party: number
    /** The waitlist lifecycle status. */
    readonly status: string
}

/** An active staff member that a resource can be linked to. */
export interface BookingBoardStaff {
    /** The staff id. */
    readonly id: string
    /** The displayed name. */
    readonly name: string
}

/** Everything the booking workbench needs for one bounded range of local dates. */
export interface BookingBoard extends BookingOverview {
    /** The IANA time zone of the business. */
    readonly timezone: string
    /** Today's local date. */
    readonly today: string
    /** The instant the board was read, in epoch milliseconds. */
    readonly nowMs: number
    /** The first local date of the selected range. */
    readonly from: string
    /** The last local date of the selected range. */
    readonly to: string
    /** The booking rules with defaults applied. */
    readonly settings: BookingSettings
    /** The complete service catalog, including inactive services. */
    readonly services: ReadonlyArray<BookingBoardServiceItem>
    /** The complete resource catalog, including inactive resources. */
    readonly resources: ReadonlyArray<BookingBoardResource>
    /** The weekly opening windows. */
    readonly hours: ReadonlyArray<WeeklyHours>
    /** The date exceptions with ids for editing. */
    readonly exceptions: ReadonlyArray<BookingBoardException>
    /** The bookings that overlap the selected range. */
    readonly bookings: ReadonlyArray<BookingBoardEntry>
    /** The waiting and notified customers. */
    readonly waitlist: ReadonlyArray<BookingBoardWait>
    /** The active staff available to resource setup. */
    readonly staff: ReadonlyArray<BookingBoardStaff>
}
