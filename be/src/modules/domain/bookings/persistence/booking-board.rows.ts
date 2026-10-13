import type {
    BookingBoardEntry,
    BookingBoardException,
    BookingBoardResource,
    BookingBoardServiceItem,
    BookingBoardWait,
} from "../booking-board.contracts"
import { hhmmOf, localDate, localHhmm } from "../policies/zoned-time.policy"
import { toBookable, toDateException, toResource } from "./booking.rows"
import type { ExceptionRow, ResourceRow, ServiceRow } from "./booking.rows"

/** A resource setup row, including display fields and its staff link. */
export interface BoardResourceRow extends ResourceRow {
    /** The resource colour. */
    readonly color: string
    /** The linked staff id, or null. */
    readonly staff_id: string | null
}

/** An editable date exception row. */
export interface BoardExceptionRow extends ExceptionRow {
    /** The exception id. */
    readonly id: string
    /** The owner's note. */
    readonly note: string
}

/** A complete appointment row, with instants selected as epoch milliseconds. */
export interface BoardBookingRow {
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
export interface BoardWaitRow {
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
export interface BoardStaffRow {
    /** The staff id. */
    readonly id: string
    /** The staff name. */
    readonly name: string
}

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR
const minutesOf = (clock: string): number => Number(clock.slice(0, 2)) * MINUTES_PER_HOUR + Number(clock.slice(3, 5))

/** The owner-visible service, including the follow-up rule. */
export const toBoardService = (row: ServiceRow): BookingBoardServiceItem => ({
    ...toBookable(row),
    followupDays: row.followup_days,
})

/** The owner-visible resource, including its display colour and staff link. */
export const toBoardResource = (row: BoardResourceRow): BookingBoardResource => ({
    ...toResource(row),
    color: row.color,
    staffId: row.staff_id,
})

/** The editable exception, including its stable id and note. */
export const toBoardException = (row: BoardExceptionRow): BookingBoardException => ({
    ...toDateException(row),
    id: row.id,
    note: row.note,
})

/** The appointment in the wall-clock coordinates used by the calendar. */
export const toBoardBooking = (row: BoardBookingRow, timezone: string): BookingBoardEntry => {
    const date = localDate(row.start_ms, timezone)
    const startClock = localHhmm(row.start_ms, timezone)
    const endClock = localDate(row.end_ms, timezone) === date ? localHhmm(row.end_ms, timezone) : "24:00"
    return {
        id: row.id,
        customer: row.customer_name,
        phone: row.customer_phone,
        serviceId: row.service_id,
        service: row.service_name,
        resourceId: row.resource_id,
        startMs: row.start_ms,
        endMs: row.end_ms,
        date,
        startMin: minutesOf(startClock),
        endMin: endClock === "24:00" ? MINUTES_PER_DAY : minutesOf(endClock),
        startClock: hhmmOf(startClock),
        endClock,
        status: row.status,
        holdsSlot: row.holds_slot,
        party: row.party_size,
        priceVnd: row.price_vnd,
        depositVnd: row.deposit_vnd,
        depositStatus: row.deposit_status,
        feeVnd: row.cancel_fee_vnd,
        checkedIn: row.checked_in,
        note: row.note,
        conflictNote: row.conflict_note,
        source: row.source_channel,
        leadId: row.lead_id,
        reschedules: row.reschedule_count,
    }
}

/** The waiting customer as shown on the workbench. */
export const toBoardWait = (row: BoardWaitRow): BookingBoardWait => ({
    id: row.id,
    customer: row.customer_name,
    phone: row.customer_phone,
    service: row.service_name,
    fromMs: row.from_ms,
    toMs: row.to_ms,
    party: row.party_size,
    status: row.status,
})
