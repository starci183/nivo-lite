import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { BookingStatus } from "./bookings.contracts"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"
import { INSERT_BOOKING, LOCK_RESOURCE, RELOCATE_BOOKING, SELECT_RESOURCE_SPANS } from "./persistence/booking-write.sql"
import { toTakenSpan } from "./persistence/booking.rows"
import type { SpanRow } from "./persistence/booking.rows"
import { peakLoad } from "./policies/availability.policy"
import { bookingIsoOf } from "./policies/zoned-time.policy"

/** A booking to write. */
export interface NewBooking {
    /** The workspace. */
    readonly workspaceId: string
    /** The customer name. */
    readonly customerName: string
    /** The customer phone, normalised. */
    readonly customerPhone: string | null
    /** The customer email. */
    readonly customerEmail: string | null
    /** The service. */
    readonly serviceId: string
    /** The resource. */
    readonly resourceId: string
    /** The start instant. */
    readonly startMs: number
    /** The end instant. */
    readonly endMs: number
    /** The end instant plus the buffer. */
    readonly blockEndMs: number
    /** How many customers come. */
    readonly partySize: number
    /** The status to start in. */
    readonly status: BookingStatus
    /** Whether the booking takes the slot; a request that conflicts does not. */
    readonly holdsSlot: boolean
    /** Where the request came from. */
    readonly sourceChannel: string
    /** The price in VND, or null. */
    readonly priceVnd: number | null
    /** The deposit in VND. */
    readonly depositVnd: number
    /** Whether the deposit is due. */
    readonly depositStatus: "none" | "due"
    /** The note. */
    readonly note: string
    /** Why the request conflicts, a code, or empty. */
    readonly conflictNote: string
    /** The key that makes a repeated request harmless, or null. */
    readonly idempotencyKey: string | null
    /** The chat the booking was asked in, so its notices are answered there; none for a page or a desk booking. */
    readonly conversationId?: string | null
    /** The customer lead of that chat, when known. */
    readonly leadId?: string | null
}

/** A booking to reserve. */
export interface ReserveParams {
    /** The transaction the reservation joins. */
    readonly manager: EntityManager
    /** The booking to write. */
    readonly booking: NewBooking
    /** Whether to take a place that is taken. */
    readonly force: boolean
}

/** What reserving a booking came to. */
export type ReserveOutcome =
    | { readonly kind: "reserved"; readonly id: string }
    | { readonly kind: "full" }
    | { readonly kind: "resource_not_found" }

/** What moving a booking came to. */
export type RelocateOutcome = "moved" | "taken" | "resource_not_found"

/** A booking to move. */
export interface RelocateParams {
    /** The transaction the move joins. */
    readonly manager: EntityManager
    /** The workspace. */
    readonly workspaceId: string
    /** The booking. */
    readonly bookingId: string
    /** The resource to move to. */
    readonly resourceId: string
    /** How many customers come. */
    readonly partySize: number
    /** The new start instant. */
    readonly startMs: number
    /** The new end instant. */
    readonly endMs: number
    /** The new end instant plus the buffer. */
    readonly blockEndMs: number
    /** The instant of the move. */
    readonly nowMs: number
    /** Whether to take a place that is taken. */
    readonly force: boolean
}

@Injectable()
/** Writes bookings under a lock on the resource, so two requests at the same instant cannot take the same place. */
export class BookingReservationService {
    /** Writes a booking if its resource still has room (or `force`); a booking that does not hold its slot always goes in. */
    async reserve(params: ReserveParams): Promise<ReserveOutcome> {
        const { manager, booking } = params
        const [lock] = await manager.query<Array<{ capacity: number }>>(LOCK_RESOURCE, [
            booking.resourceId,
            booking.workspaceId,
        ])
        if (lock === undefined) return { kind: "resource_not_found" }
        if (booking.holdsSlot && !params.force) {
            const spans = await manager.query<Array<SpanRow>>(SELECT_RESOURCE_SPANS, [
                booking.resourceId,
                bookingIsoOf(booking.startMs),
                bookingIsoOf(booking.blockEndMs),
                null,
            ])
            const load = peakLoad(spans.map(toTakenSpan), booking.resourceId, booking.startMs, booking.blockEndMs, null)
            if (load + booking.partySize > lock.capacity) return { kind: "full" }
        }
        const [row] = await manager.query<Array<{ id: string }>>(INSERT_BOOKING, [
            booking.workspaceId,
            booking.customerName,
            booking.customerPhone,
            booking.customerEmail,
            booking.serviceId,
            booking.resourceId,
            bookingIsoOf(booking.startMs),
            bookingIsoOf(booking.endMs),
            bookingIsoOf(booking.blockEndMs),
            booking.partySize,
            booking.status,
            booking.holdsSlot,
            booking.sourceChannel,
            booking.priceVnd,
            booking.depositVnd,
            booking.depositStatus,
            booking.note,
            booking.conflictNote,
            booking.idempotencyKey,
            booking.conversationId ?? null,
            booking.leadId ?? null,
        ])
        if (row === undefined) throw new BookingsError({ code: BookingsErrorCode.NotCreated })
        return { kind: "reserved", id: row.id }
    }

    /** Moves a booking to another time or resource if there is room (excluding itself), or `force`. */
    async relocate(params: RelocateParams): Promise<RelocateOutcome> {
        const { manager } = params
        const [lock] = await manager.query<Array<{ capacity: number }>>(LOCK_RESOURCE, [
            params.resourceId,
            params.workspaceId,
        ])
        if (lock === undefined) return "resource_not_found"
        if (!params.force) {
            const spans = await manager.query<Array<SpanRow>>(SELECT_RESOURCE_SPANS, [
                params.resourceId,
                bookingIsoOf(params.startMs),
                bookingIsoOf(params.blockEndMs),
                params.bookingId,
            ])
            const load = peakLoad(
                spans.map(toTakenSpan),
                params.resourceId,
                params.startMs,
                params.blockEndMs,
                params.bookingId,
            )
            if (load + params.partySize > lock.capacity) return "taken"
        }
        await manager.query(RELOCATE_BOOKING, [
            params.workspaceId,
            params.bookingId,
            params.resourceId,
            bookingIsoOf(params.startMs),
            bookingIsoOf(params.endMs),
            bookingIsoOf(params.blockEndMs),
            bookingIsoOf(params.nowMs),
        ])
        return "moved"
    }
}
