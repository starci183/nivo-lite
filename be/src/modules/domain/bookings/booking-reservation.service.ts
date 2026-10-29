import { Injectable } from "@nestjs/common"
import { In, LessThan, MoreThan, Not } from "typeorm"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { BookingResourcesReadService } from "@modules/domain/booking-resources"
import type { BookingResourceCapacity } from "@modules/domain/booking-resources"
import { returnedRows, rowShape } from "@modules/platform/database"
import { toTakenSpan } from "./booking-model.mapper"
import { ACTIVE_STATUSES } from "./bookings.contracts"
import type { BookingStatus } from "./bookings.contracts"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"
import { BookingEntity } from "./persistence/entities"
import { peakLoad } from "./policies/availability.policy"

const SPANS_LIMIT = 5000

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
    constructor(private readonly resources: BookingResourcesReadService) {}

    /** Writes a booking if its resource still has room (or `force`); a booking that does not hold its slot always goes in. */
    async reserve(params: ReserveParams): Promise<ReserveOutcome> {
        const { manager, booking } = params
        const resource = await this.lockResource(manager, booking.resourceId, booking.workspaceId)
        if (resource === null) return { kind: "resource_not_found" }
        if (booking.holdsSlot && !params.force) {
            const spans = await this.spansOf(manager, booking.resourceId, booking.startMs, booking.blockEndMs, null)
            const load = peakLoad(spans.map(toTakenSpan), booking.resourceId, booking.startMs, booking.blockEndMs, null)
            if (load + booking.partySize > resource.capacity) return { kind: "full" }
        }
        const inserted = await manager
            .createQueryBuilder(BookingEntity, "bo")
            .insert()
            .values({
                workspaceId: booking.workspaceId,
                customerName: booking.customerName,
                customerPhone: booking.customerPhone,
                customerEmail: booking.customerEmail,
                serviceId: booking.serviceId,
                resourceId: booking.resourceId,
                startAt: new Date(booking.startMs),
                endAt: new Date(booking.endMs),
                blockEndAt: new Date(booking.blockEndMs),
                partySize: booking.partySize,
                status: booking.status,
                holdsSlot: booking.holdsSlot,
                sourceChannel: booking.sourceChannel,
                priceVnd: booking.priceVnd === null ? null : String(booking.priceVnd),
                depositVnd: String(booking.depositVnd),
                depositStatus: booking.depositStatus,
                note: booking.note,
                conflictNote: booking.conflictNote,
                idempotencyKey: booking.idempotencyKey,
                conversationId: booking.conversationId ?? null,
                leadId: booking.leadId ?? null,
            })
            .returning("id")
            .execute()
        const [row] = Array.isArray(inserted.raw) ? returnedRows(inserted.raw, rowShape({ id: "string" })) : []
        if (row === undefined) throw new BookingsError({ code: BookingsErrorCode.NotCreated })
        return { kind: "reserved", id: row.id }
    }

    /** Moves a booking to another time or resource if there is room (excluding itself), or `force`. */
    async relocate(params: RelocateParams): Promise<RelocateOutcome> {
        const { manager } = params
        const resource = await this.lockResource(manager, params.resourceId, params.workspaceId)
        if (resource === null) return "resource_not_found"
        if (!params.force) {
            const spans = await this.spansOf(
                manager,
                params.resourceId,
                params.startMs,
                params.blockEndMs,
                params.bookingId,
            )
            const load = peakLoad(
                spans.map(toTakenSpan),
                params.resourceId,
                params.startMs,
                params.blockEndMs,
                params.bookingId,
            )
            if (load + params.partySize > resource.capacity) return "taken"
        }
        const moved = "CAST(:startAt AS timestamptz) <> start_at"
        await manager
            .createQueryBuilder(BookingEntity, "bo")
            .update()
            .set({
                resourceId: params.resourceId,
                startAt: new Date(params.startMs),
                endAt: new Date(params.endMs),
                blockEndAt: new Date(params.blockEndMs),
                holdsSlot: true,
                rescheduledFrom: () => `CASE WHEN ${moved} THEN start_at ELSE rescheduled_from END`,
                rescheduleCount: () => `reschedule_count + CASE WHEN ${moved} THEN 1 ELSE 0 END`,
                status: () =>
                    `CASE WHEN ${moved} AND status IN ('confirmed', 'rescheduled') THEN 'rescheduled' ELSE status END`,
                conflictNote: "",
                updatedAt: new Date(params.nowMs),
            })
            .where({ workspaceId: params.workspaceId, id: params.bookingId })
            .setParameter("startAt", new Date(params.startMs))
            .execute()
        return "moved"
    }

    /** Locks one resource of a workspace for the rest of the transaction and answers its capacity, or null when it is not there. */
    private lockResource(
        manager: EntityManager,
        resourceId: string,
        workspaceId: string,
    ): Promise<BookingResourceCapacity | null> {
        return this.resources.lockCapacity(manager, workspaceId, resourceId)
    }

    /** The bookings that hold one resource between two instants, optionally leaving one out. */
    private spansOf(
        manager: EntityManager,
        resourceId: string,
        fromMs: number,
        toMs: number,
        excludedId: string | null,
    ): Promise<Array<BookingEntity>> {
        const where: FindOptionsWhere<BookingEntity> = {
            resourceId,
            holdsSlot: true,
            status: In(ACTIVE_STATUSES),
            startAt: LessThan(new Date(toMs)),
            blockEndAt: MoreThan(new Date(fromMs)),
            ...(excludedId === null ? {} : { id: Not(excludedId) }),
        }
        return manager.find(BookingEntity, {
            select: { id: true, resourceId: true, partySize: true, startAt: true, blockEndAt: true },
            where,
            take: SPANS_LIMIT,
        })
    }
}
