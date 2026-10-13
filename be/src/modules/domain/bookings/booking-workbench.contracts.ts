import type { BookingBoard } from "./booking-board.contracts"
import type { AddBookingParams, BookingStats } from "./bookings.contracts"
import type {
    SaveBookingExceptionParams,
    SaveBookingResourceParams,
    SaveBookingServiceParams,
} from "./booking-setup.contracts"

/** Optional local-date arguments before omitted values are resolved by the calendar. */
export interface BookingBoardDraft {
    /** First local date, or null to use the current week. */
    readonly from?: string | null
    /** Last local date, or null to use a seven-day range. */
    readonly to?: string | null
}

/** A named lifecycle count for transports without arbitrary record fields. */
export interface BookingStatusCount {
    /** Lifecycle value whose appointments are counted. */
    readonly status: string
    /** Number of appointments in that lifecycle value. */
    readonly count: number
}

/** Calendar statistics with status counts represented as typed rows. */
export interface BookingStatsProjection extends Omit<BookingStats, "byStatus"> {
    /** Counts for every status present in the selected date range. */
    readonly byStatus: ReadonlyArray<BookingStatusCount>
}

/** Complete calendar projection for transports that expose typed status-count rows. */
export interface BookingBoardProjection extends Omit<BookingBoard, "stats"> {
    /** Statistics of the date range, including named lifecycle counts. */
    readonly stats: BookingStatsProjection
}

/** Identity of a booking whose requested placement succeeded. */
export interface BookingPlacement {
    /** Appointment created or moved by the desk. */
    readonly id: string
}

/** A desk draft before optional resource and customer details receive defaults. */
export interface BookingDeskDraft extends Omit<AddBookingParams, "workspaceId" | "resourceId" | "phone" | "note"> {
    /** Requested resource, or null to choose an available one. */
    readonly resourceId?: string | null
    /** Customer phone, absent when the owner did not enter one. */
    readonly phone?: string | null
    /** Owner's note, absent when the form is blank. */
    readonly note?: string | null
}

/** Service setup draft before omitted optional fields become explicit null values. */
export interface BookingServiceDraft extends Omit<
    SaveBookingServiceParams,
    "workspaceId" | "id" | "priceVnd" | "followupDays"
> {
    /** Existing catalog identity, absent when creating a service. */
    readonly id?: string | null
    /** Fixed visit price, absent when pricing is open. */
    readonly priceVnd?: number | null
    /** Days before a follow-up, absent when that action is disabled. */
    readonly followupDays?: number | null
}

/** Resource setup draft before omitted catalog and staff identities become null. */
export interface BookingResourceDraft extends Omit<SaveBookingResourceParams, "workspaceId" | "id" | "staffId"> {
    /** Existing catalog identity, absent when creating a resource. */
    readonly id?: string | null
    /** Staff link, absent for an unassigned resource. */
    readonly staffId?: string | null
}

/** Opening exception draft before the whole-business resource default is applied. */
export interface BookingExceptionDraft extends Omit<SaveBookingExceptionParams, "workspaceId" | "resourceId"> {
    /** Resource whose calendar changes, absent for the whole business. */
    readonly resourceId?: string | null
}
