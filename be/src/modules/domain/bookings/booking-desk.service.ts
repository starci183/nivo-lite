import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { BookingModelService } from "./booking-model.service"
import { BookingRemindersService } from "@modules/domain/booking-reminders"
import { BookingReservationService } from "./booking-reservation.service"
import type {
    AddBookingParams,
    BookableService,
    BookingModel,
    BookingRef,
    DeskPlacement,
    DeskRefusal,
    MoveBookingParams,
    StatusChange,
} from "./bookings.contracts"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"
import { BookingServiceEntity } from "@modules/domain/booking-services"
import type { BookingStateFacts } from "./booking-facts.contracts"
import { BookingEntity } from "./persistence/entities"
import { checkSlot } from "./policies/availability.policy"
import type { SlotCheck } from "./policies/availability.policy"
import {
    clampParty,
    depositFor,
    deskReasonOf,
    fallbackResource,
    isActiveStatus,
    isLocalDateTime,
    normalisePhone,
    planInputOf,
} from "./policies/booking-rules.policy"
import { zonedMs } from "./policies/zoned-time.policy"

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

const refusal = (reason: DeskRefusal): DeskPlacement => ({ ok: false, reason, id: null })

@Injectable()
/** What the owner does on the calendar: adding and moving a booking and changing its status. The owner is the authority, so nothing here asks anyone. */
export class BookingDeskService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly models: BookingModelService,
        private readonly reservation: BookingReservationService,
        private readonly reminders: BookingRemindersService,
    ) {}

    /** Adds a booking by hand: held and confirmed at once. An empty resource picks a free one; a taken place is refused unless forced. */
    async add(userId: string, params: AddBookingParams): Promise<DeskPlacement> {
        await this.members.require(userId, params.workspaceId, ["owner", "manager"])
        const name = params.name.trim()
        if (params.serviceId === "") return refusal("service_required")
        if (name === "") return refusal("name_required")
        if (!isLocalDateTime(params.date, params.time)) return refusal("datetime_invalid")
        const model = await this.models.model(params.workspaceId)
        const service = model.services.find((candidate) => candidate.id === params.serviceId)
        if (service === undefined) return refusal("service_not_found")
        const timeZone = model.settings.timezone
        const startMs = zonedMs(params.date, params.time, timeZone)
        const nowMs = this.clock.now().getTime()
        const taken = await this.models.spans(params.workspaceId, startMs - DAY_MS, startMs + 2 * DAY_MS, timeZone)
        const party = clampParty(params.party)
        const open = planInputOf(model, service, taken, nowMs, party)
        const plan = { ...open, policy: { ...open.policy, minLeadMin: 0, maxAdvanceDays: 365 } }
        const check = checkSlot(plan, startMs)
        if (params.resourceId === "" && !check.ok && !params.force) return refusal(deskReasonOf(check.why))
        const resourceId = this.pickResource(params, check, model, service)
        if (resourceId === "") return refusal("no_resource")
        const endMs = startMs + service.durationMin * MINUTE_MS
        const deposit = depositFor(service.priceVnd, model.settings.depositPct)
        return this.entityManager.transaction(async (manager) => {
            const outcome = await this.reservation.reserve({
                manager,
                force: params.force,
                booking: {
                    workspaceId: params.workspaceId,
                    customerName: name,
                    customerPhone: normalisePhone(params.phone),
                    customerEmail: null,
                    serviceId: service.id,
                    resourceId,
                    startMs,
                    endMs,
                    blockEndMs: endMs + service.bufferMin * MINUTE_MS,
                    partySize: party,
                    status: "confirmed",
                    holdsSlot: true,
                    sourceChannel: "manual",
                    priceVnd: service.priceVnd,
                    depositVnd: deposit,
                    depositStatus: deposit > 0 ? "due" : "none",
                    note: params.note.trim().slice(0, 400),
                    conflictNote: "",
                    idempotencyKey: null,
                },
            })
            if (outcome.kind !== "reserved") return refusal(outcome.kind === "full" ? "taken" : "resource_not_found")
            await this.reminders.schedule({
                manager,
                workspaceId: params.workspaceId,
                bookingId: outcome.id,
                startMs,
                nowMs,
                defaultHours: model.settings.reminderHours,
            })
            return { ok: true, reason: null, id: outcome.id }
        })
    }

    /** Moves a booking to another time or resource; a taken place is refused unless forced. */
    async move(userId: string, params: MoveBookingParams): Promise<DeskPlacement> {
        await this.members.require(userId, params.workspaceId, ["owner", "manager"])
        return this.moveApproved(params)
    }

    /**
     * Moves a booking once the decision is taken (the owner on the calendar, or the gate on a customer's request): an empty resource keeps
     * the booking's own; a taken place is refused unless forced.
     */
    async moveApproved(params: MoveBookingParams): Promise<DeskPlacement> {
        const settings = await this.models.settings(params.workspaceId)
        const startMs = Date.parse(params.startAt)
        const nowMs = this.clock.now().getTime()
        return this.entityManager.transaction(async (manager) => {
            const booking = await this.lock(manager, params)
            if (!isActiveStatus(booking.status)) return refusal("not_movable")
            const endMs = startMs + booking.duration_min * MINUTE_MS
            const outcome = await this.reservation.relocate({
                manager,
                workspaceId: params.workspaceId,
                bookingId: params.id,
                resourceId: params.resourceId === "" ? booking.resource_id : params.resourceId,
                partySize: booking.party_size,
                startMs,
                endMs,
                blockEndMs: endMs + booking.buffer_min * MINUTE_MS,
                nowMs,
                force: params.force,
            })
            if (outcome !== "moved") return refusal(outcome)
            await this.reminders.schedule({
                manager,
                workspaceId: params.workspaceId,
                bookingId: params.id,
                startMs,
                nowMs,
                defaultHours: settings.reminderHours,
            })
            return { ok: true, reason: null, id: params.id }
        })
    }

    /** Confirms a requested booking and plans its reminders; a booking that is not a request stays as it is. */
    async confirm(userId: string, ref: BookingRef): Promise<StatusChange> {
        await this.members.require(userId, ref.workspaceId, ["owner", "manager"])
        return this.confirmApproved(ref)
    }

    /** Confirms a requested booking once the decision is taken (the owner, or the gate); anything else stays as it is. */
    async confirmApproved(ref: BookingRef): Promise<StatusChange> {
        const settings = await this.models.settings(ref.workspaceId)
        const nowMs = this.clock.now().getTime()
        return this.entityManager.transaction(async (manager) => {
            const booking = await this.lock(manager, ref)
            if (booking.status !== "requested") return { status: booking.status, feeDue: false }
            await manager.update(
                BookingEntity,
                { workspaceId: ref.workspaceId, id: ref.id },
                { status: "confirmed", holdsSlot: true, conflictNote: "", updatedAt: new Date(nowMs) },
            )
            await this.reminders.schedule({
                manager,
                workspaceId: ref.workspaceId,
                bookingId: ref.id,
                startMs: booking.start_ms,
                nowMs,
                defaultHours: settings.reminderHours,
            })
            return { status: "confirmed", feeDue: false }
        })
    }

    /** Records that the customer arrived. */
    async checkIn(userId: string, ref: BookingRef): Promise<StatusChange> {
        await this.members.require(userId, ref.workspaceId, ["owner", "manager"])
        const nowMs = this.clock.now().getTime()
        return this.entityManager.transaction(async (manager) => {
            await this.lockActive(manager, ref)
            await manager.update(
                BookingEntity,
                { workspaceId: ref.workspaceId, id: ref.id },
                { checkedInAt: new Date(nowMs), status: "confirmed", updatedAt: new Date(nowMs) },
            )
            return { status: "confirmed", feeDue: false }
        })
    }

    /** Marks a booking done and stops its reminders. */
    async done(userId: string, ref: BookingRef): Promise<StatusChange> {
        await this.members.require(userId, ref.workspaceId, ["owner", "manager"])
        const nowMs = this.clock.now().getTime()
        return this.entityManager.transaction(async (manager) => {
            await this.lockActive(manager, ref)
            await manager
                .createQueryBuilder(BookingEntity, "bo")
                .update()
                .set({
                    status: "done",
                    doneAt: new Date(nowMs),
                    checkedInAt: () => "COALESCE(checked_in_at, :now)",
                    updatedAt: new Date(nowMs),
                })
                .where({ workspaceId: ref.workspaceId, id: ref.id })
                .setParameter("now", new Date(nowMs))
                .execute()
            await this.reminders.cancel(manager, ref.id, "booking_done")
            return { status: "done", feeDue: false }
        })
    }

    /** Records that the customer did not come and stops the reminders; a fee is due when the policy has one. */
    async noShow(userId: string, ref: BookingRef): Promise<StatusChange> {
        await this.members.require(userId, ref.workspaceId, ["owner", "manager"])
        const settings = await this.models.settings(ref.workspaceId)
        const nowMs = this.clock.now().getTime()
        return this.entityManager.transaction(async (manager) => {
            await this.lockActive(manager, ref)
            await manager.update(
                BookingEntity,
                { workspaceId: ref.workspaceId, id: ref.id },
                { status: "no_show", updatedAt: new Date(nowMs) },
            )
            await this.reminders.cancel(manager, ref.id, "no_show")
            return { status: "no_show", feeDue: settings.noShowFeeVnd > 0 }
        })
    }

    /** Cancels a booking, frees its place and stops its reminders. */
    async cancel(userId: string, ref: BookingRef): Promise<StatusChange> {
        await this.members.require(userId, ref.workspaceId, ["owner", "manager"])
        const nowMs = this.clock.now().getTime()
        return this.entityManager.transaction(async (manager) => {
            await this.lockActive(manager, ref)
            await this.cancelRow(manager, ref, nowMs, "owner_cancelled")
            await this.reminders.cancel(manager, ref.id, "owner_cancelled")
            return { status: "cancelled", feeDue: false }
        })
    }

    /**
     * Cancels a booking the gate let a customer's request through for; a booking that is already closed answers its status and changes
     * nothing. The fee of a late cancellation and the notice to the customer follow from the status change (the booking_status_changed reactor).
     */
    cancelApproved(ref: BookingRef, reason: string): Promise<StatusChange> {
        const nowMs = this.clock.now().getTime()
        return this.entityManager.transaction(async (manager) => {
            const booking = await this.lock(manager, ref)
            if (!isActiveStatus(booking.status)) return { status: booking.status, feeDue: false }
            await this.cancelRow(manager, ref, nowMs, reason)
            await this.reminders.cancel(manager, ref.id, "customer_cancelled")
            return { status: "cancelled", feeDue: false }
        })
    }

    private pickResource(
        params: AddBookingParams,
        check: SlotCheck,
        model: BookingModel,
        service: BookableService,
    ): string {
        if (params.resourceId !== "") return params.resourceId
        if (check.ok) return check.slot.resourceId
        return fallbackResource(model.resources, service.resourceKind)?.id ?? ""
    }

    private async cancelRow(manager: EntityManager, ref: BookingRef, nowMs: number, reason: string): Promise<void> {
        await manager.update(
            BookingEntity,
            { workspaceId: ref.workspaceId, id: ref.id },
            {
                status: "cancelled",
                holdsSlot: false,
                cancelledAt: new Date(nowMs),
                cancelReason: reason,
                updatedAt: new Date(nowMs),
            },
        )
    }

    private async lock(manager: EntityManager, ref: BookingRef): Promise<BookingStateFacts> {
        const row = await manager
            .createQueryBuilder(BookingEntity, "b")
            .innerJoin(BookingServiceEntity, "s", "s.id = b.serviceId")
            .select("b.id", "id")
            .addSelect("b.resourceId", "resource_id")
            .addSelect("b.partySize", "party_size")
            .addSelect("b.status", "status")
            .addSelect("s.durationMin", "duration_min")
            .addSelect("s.bufferMin", "buffer_min")
            .addSelect("CAST(extract(epoch FROM b.startAt) * 1000 AS float8)", "start_ms")
            .where("b.workspaceId = :workspaceId AND b.id = :id", { workspaceId: ref.workspaceId, id: ref.id })
            .limit(1)
            .setLock("pessimistic_write", undefined, ["b"])
            .getRawOne<BookingStateFacts>()
        if (row === undefined) throw new BookingsError({ code: BookingsErrorCode.NotFound })
        return row
    }

    private async lockActive(manager: EntityManager, ref: BookingRef): Promise<BookingStateFacts> {
        const row = await this.lock(manager, ref)
        if (!isActiveStatus(row.status)) throw new BookingsError({ code: BookingsErrorCode.NotChangeable })
        return row
    }
}
