import type { BookingStatus } from "./bookings.contracts"

/** The booking a status event is applied to, with its service name and the instants as epoch milliseconds. */
export interface EffectsRow {
    /** The booking id. */
    readonly id: string
    /** The workspace of the booking. */
    readonly workspace_id: string
    /** The status now. */
    readonly status: string
    /** The lead of the customer, or null. */
    readonly lead_id: string | null
    /** The conversation the booking came from, or null. */
    readonly conversation_id: string | null
    /** The customer name. */
    readonly customer_name: string
    /** The customer phone. */
    readonly customer_phone: string | null
    /** The customer email. */
    readonly customer_email: string | null
    /** Why it was cancelled, or null. */
    readonly cancel_reason: string | null
    /** How many times it was moved. */
    readonly reschedule_count: number
    /** The name of the service. */
    readonly service_name: string
    /** The price in VND, or null. */
    readonly price_vnd: number | null
    /** The fee recorded so far. */
    readonly cancel_fee_vnd: number
    /** The start instant. */
    readonly start_ms: number
    /** The instant it was cancelled, or null. */
    readonly cancelled_ms: number | null
    /** The name of the resource, or an empty text. */
    readonly resource_name: string
    /** The deposit in VND. */
    readonly deposit_vnd: number
    /** The start it was moved from, or null when it never moved. */
    readonly from_ms: number | null
    /** Whether the booking holds its slot. */
    readonly holds_slot: boolean
}

/** The customer's earliest future requested or confirmed booking that has not checked in. */
export interface CancellableFacts {
    /** The booking to name in the owner's cancellation decision. */
    readonly id: string
    /** The customer lead, or null when no lead is linked. */
    readonly lead_id: string | null
    /** The name of the customer who booked. */
    readonly customer_name: string
    /** The service name from the same workspace. */
    readonly service_name: string
    /** The booking start as epoch milliseconds. */
    readonly start_ms: number
}

/** One locked booking with the timing of its service. */
export interface BookingStateFacts {
    /** The id. */
    readonly id: string
    /** The resource id. */
    readonly resource_id: string
    /** The party size. */
    readonly party_size: number
    /** The status. */
    readonly status: BookingStatus
    /** The duration min. */
    readonly duration_min: number
    /** The buffer min. */
    readonly buffer_min: number
    /** The start ms. */
    readonly start_ms: number
}

/** The published page that owns a slug, with the shop name. */
export interface PublishedPageFacts {
    /** The workspace id. */
    readonly workspace_id: string
    /** The public note. */
    readonly public_note: string
    /** The address. */
    readonly address: string
    /** The timezone. */
    readonly timezone: string
    /** The shop. */
    readonly shop: string
}

/** The approved leave days of staff linked to a resource. */
export interface LeaveDayFacts {
    /** The resource id. */
    readonly resource_id: string
    /** The leave staff. */
    readonly leave_staff: string
    /** The from date. */
    readonly from_date: string
    /** The to date. */
    readonly to_date: string
}

/** A complete appointment of the board, with instants as epoch milliseconds. */
export interface BoardBookingFacts {
    /** The booking id. */
    readonly id: string
    /** The customer name. */
    readonly customer_name: string
    /** The customer phone, or null. */
    readonly customer_phone: string | null
    /** The service id. */
    readonly service_id: string
    /** The current service name. */
    readonly service_name: string
    /** The assigned resource id. */
    readonly resource_id: string
    /** The start instant. */
    readonly start_ms: number
    /** The visit end instant. */
    readonly end_ms: number
    /** The booking status. */
    readonly status: string
    /** Whether the booking holds resource capacity. */
    readonly holds_slot: boolean
    /** The number of customers. */
    readonly party_size: number
    /** The price in VND, or null. */
    readonly price_vnd: number | null
    /** The deposit in VND. */
    readonly deposit_vnd: number
    /** The deposit status. */
    readonly deposit_status: string
    /** The fee in VND. */
    readonly cancel_fee_vnd: number
    /** Whether the customer has checked in. */
    readonly checked_in: boolean
    /** The booking note. */
    readonly note: string
    /** The note explaining a forced placement. */
    readonly conflict_note: string
    /** The source channel. */
    readonly source_channel: string
    /** The linked lead id, or null. */
    readonly lead_id: string | null
    /** How many times the booking was moved. */
    readonly reschedule_count: number
}

/** One waitlist customer with the current service name and epoch-millisecond window. */
export interface BoardWaitFacts {
    /** The entry id. */
    readonly id: string
    /** The customer name. */
    readonly customer_name: string
    /** The customer phone, or null. */
    readonly customer_phone: string | null
    /** The current service name. */
    readonly service_name: string
    /** The beginning of the requested window. */
    readonly from_ms: number
    /** The end of the requested window. */
    readonly to_ms: number
    /** The number of customers. */
    readonly party_size: number
    /** The waitlist status. */
    readonly status: string
}

/** One active staff choice. */
export interface BoardStaffFacts {
    /** The staff id. */
    readonly id: string
    /** The staff name. */
    readonly name: string
}

/** How many open bookings still owe a deposit, and how much. */
export interface DepositsDueFacts {
    /** The total. */
    readonly total: number
    /** The amount vnd. */
    readonly amount_vnd: number
}

/** How many bookings finished with one status. */
export interface FinishedCountFacts {
    /** The status. */
    readonly status: string
    /** The total. */
    readonly total: number
}
