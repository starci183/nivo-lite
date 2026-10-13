import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { BookingModelService } from "./booking-model.service"
import { BookingRemindersService } from "@modules/domain/booking-reminders"
import { BookingReservationService } from "./booking-reservation.service"
import type { NewBooking, ReserveOutcome } from "./booking-reservation.service"
import type {
    BookableService,
    BookingModel,
    BookingPlacement,
    BookingPlacementParams,
    OptionalCancellableBooking,
    PublicBookCode,
    PublicBookParams,
    PublicBookResult,
    PublicPageParams,
    PublicPageView,
    PublicTimes,
    PublicTimesParams,
    WorkspaceBookParams,
    WorkspaceBookingCatalog,
    WorkspaceTimesParams,
} from "./bookings.contracts"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"
import { SELECT_BOOKING_BY_KEY, SELECT_NEXT_CANCELLABLE_BOOKING } from "./persistence/booking-write.sql"
import { SELECT_PAGE_BY_SLUG } from "./persistence/booking-model.sql"
import type { CancellableBookingRow, KeyedBookingRow, PageRow } from "./persistence/booking.rows"
import { checkSlot, findSlots, nearestSlots } from "./policies/availability.policy"
import {
    clampParty,
    depositFor,
    fallbackResource,
    idempotencyKeyOf,
    isPlausiblePhone,
    normaliseEmail,
    normalisePhone,
    planInputOf,
} from "./policies/booking-rules.policy"
import { addDays, zonedMs, bookingIsoOf } from "./policies/zoned-time.policy"

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000
const SLOTS_MAX = 200
const ALTERNATIVES = 3
const ALTERNATIVE_SPAN_DAYS = 7
const UNIQUE_VIOLATION = "23505"

const isUniqueViolation = (cause: unknown): boolean => {
    if (typeof cause !== "object" || cause === null) return false
    if ("code" in cause && cause.code === UNIQUE_VIOLATION) return true
    return "driverError" in cause && isUniqueViolation(cause.driverError)
}

@Injectable()
/** The public booking page: what it shows, which times are free and the request a visitor sends; no session, so every input is checked here. */
export class BookingPublicService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly models: BookingModelService,
        private readonly reservation: BookingReservationService,
        private readonly reminders: BookingRemindersService,
    ) {}

    /** Supplies active workspace services and timezone to callers that do not use a published page. */
    async catalogIn(workspaceId: string): Promise<WorkspaceBookingCatalog> {
        const model = await this.models.model(workspaceId)
        return {
            timezone: model.settings.timezone,
            services: model.services.filter((service) => service.active),
        }
    }

    /** The page of a published slug with its active services. */
    async page(request: PublicPageParams): Promise<PublicPageView> {
        const row = await this.published(request.slug)
        const model = await this.models.model(row.workspace_id)
        return {
            shop: row.shop,
            slug: request.slug,
            note: row.public_note,
            address: row.address,
            timezone: row.timezone,
            services: model.services
                .filter((service) => service.active)
                .map((service) => ({
                    id: service.id,
                    name: service.name,
                    description: service.description,
                    durationMin: service.durationMin,
                    priceVnd: service.priceVnd,
                })),
        }
    }

    /** The free start times of an active service on a local day; none for a service the page does not offer. */
    async freeTimes(request: PublicTimesParams): Promise<PublicTimes> {
        const row = await this.published(request.slug)
        return this.freeTimesIn({
            workspaceId: row.workspace_id,
            service: request.service,
            date: request.date,
            party: request.party,
        })
    }

    /** The same free starts for an active workspace service without requiring a published page. */
    async freeTimesIn(request: WorkspaceTimesParams): Promise<PublicTimes> {
        const model = await this.models.model(request.workspaceId)
        const service = this.offered(model, request.service)
        if (service === undefined) return { times: [] }
        const timeZone = model.settings.timezone
        const fromMs = zonedMs(request.date, "00:00", timeZone)
        const toMs = zonedMs(addDays(request.date, 1), "00:00", timeZone)
        const taken = await this.models.spans(request.workspaceId, fromMs, toMs + DAY_MS, timeZone)
        const plan = planInputOf(model, service, taken, this.clock.now().getTime(), clampParty(request.party))
        const times = findSlots(plan, fromMs, toMs)
            .slice(0, SLOTS_MAX)
            .map((slot) => bookingIsoOf(slot.startMs))
        return { times: [...new Set(times)] }
    }

    /** Records a visitor's request: held and confirmed when the time is free and the owner confirms by itself, held for the owner when it is free, parked without a hold when it is taken. */
    async book(request: PublicBookParams): Promise<PublicBookResult> {
        const row = await this.published(request.slug)
        if (request.website.trim() !== "") return this.answer("received_free", "waiting", true, "", "", [], null)
        return this.requestIn({
            workspaceId: row.workspace_id,
            serviceId: request.serviceId,
            start: request.start,
            name: request.name,
            phone: request.phone,
            email: request.email,
            party: request.party,
            note: request.note,
            token: request.token,
            sourceChannel: "public_page",
        })
    }

    /** Records a workspace request with the public page's validation, reservation, parking and reminder rules. */
    async requestIn(request: WorkspaceBookParams): Promise<PublicBookResult> {
        const name = request.name.trim().slice(0, 120)
        const phone = normalisePhone(request.phone)
        const startMs = Date.parse(request.start)
        if (name === "") return this.invalid("name_required")
        if (!isPlausiblePhone(phone)) return this.invalid("phone_invalid")
        if (!Number.isFinite(startMs)) return this.invalid("start_invalid")
        const model = await this.models.model(request.workspaceId)
        const service = this.offered(model, request.serviceId)
        if (service === undefined) return this.invalid("service_unavailable")
        const key = request.sourceChannel === "chat" ? request.token || null : idempotencyKeyOf(request.token)
        const repeated = key === null ? undefined : await this.keyed(request.workspaceId, key)
        if (repeated !== undefined) return this.repeatedAnswer(repeated, service.name, startMs)
        const timeZone = model.settings.timezone
        const nowMs = this.clock.now().getTime()
        const party = clampParty(request.party)
        const taken = await this.models.spans(request.workspaceId, startMs - DAY_MS, startMs + 2 * DAY_MS, timeZone)
        const plan = planInputOf(model, service, taken, nowMs, party)
        const check = checkSlot(plan, startMs)
        let placement: BookingPlacement
        try {
            placement = await this.entityManager.transaction((manager) =>
                this.place({
                    manager,
                    model,
                    service,
                    check,
                    startMs,
                    nowMs,
                    request,
                    name,
                    phone,
                    party,
                    key,
                }),
            )
        } catch (cause) {
            if (request.sourceChannel !== "chat" || key === null || !isUniqueViolation(cause)) throw cause
            const concurrent = await this.keyed(request.workspaceId, key)
            if (concurrent === undefined) throw cause
            return this.repeatedAnswer(concurrent, service.name, startMs)
        }
        if (placement.kind === "no_resource")
            return this.answer("no_resource", "failed", false, service.name, bookingIsoOf(startMs), [], null)
        const alternatives = placement.free
            ? []
            : nearestSlots(plan, startMs, ALTERNATIVES, ALTERNATIVE_SPAN_DAYS).map((slot) => bookingIsoOf(slot.startMs))
        const code = this.codeFor(placement.free, model.settings.autoConfirm)
        return this.answer(
            code,
            code === "confirmed" ? "confirmed" : "waiting",
            true,
            service.name,
            bookingIsoOf(startMs),
            alternatives,
            placement.id,
        )
    }

    /** Finds the customer's next future request or confirmation without changing the booking. */
    async nextCancellable(workspaceId: string, phone: string, nowMs: number): Promise<OptionalCancellableBooking> {
        const normalised = normalisePhone(phone)
        if (normalised === null) return null
        const [row] = await this.entityManager.query<Array<CancellableBookingRow>>(SELECT_NEXT_CANCELLABLE_BOOKING, [
            workspaceId,
            normalised,
            bookingIsoOf(nowMs),
        ])
        return row === undefined
            ? null
            : {
                  id: row.id,
                  leadId: row.lead_id,
                  startIso: bookingIsoOf(row.start_ms),
                  serviceName: row.service_name,
                  customerName: row.customer_name,
              }
    }

    private async published(slug: string): Promise<PageRow> {
        const [row] = await this.entityManager.query<Array<PageRow>>(SELECT_PAGE_BY_SLUG, [slug])
        if (row === undefined) throw new BookingsError({ code: BookingsErrorCode.PageNotFound })
        return row
    }

    private async keyed(workspaceId: string, key: string): Promise<KeyedBookingRow | undefined> {
        const [row] = await this.entityManager.query<Array<KeyedBookingRow>>(SELECT_BOOKING_BY_KEY, [workspaceId, key])
        return row
    }

    private offered(model: BookingModel, serviceId: string): BookableService | undefined {
        return model.services.find((service) => service.id === serviceId && service.active)
    }

    private async place(args: BookingPlacementParams): Promise<BookingPlacement> {
        const { manager, model, service, check, startMs } = args
        const endMs = startMs + service.durationMin * MINUTE_MS
        const blockEndMs = endMs + service.bufferMin * MINUTE_MS
        const deposit = depositFor(service.priceVnd, model.settings.depositPct)
        const depositStatus: NewBooking["depositStatus"] = deposit > 0 ? "due" : "none"
        const base = {
            workspaceId: args.request.workspaceId,
            customerName: args.name,
            customerPhone: args.phone,
            customerEmail: normaliseEmail(args.request.email),
            serviceId: service.id,
            startMs,
            endMs,
            blockEndMs,
            partySize: args.party,
            sourceChannel: args.request.sourceChannel,
            priceVnd: service.priceVnd,
            depositVnd: deposit,
            depositStatus,
            note: args.request.note.trim().slice(0, 400),
            idempotencyKey: args.key,
        }
        const confirmed = model.settings.autoConfirm
        const first: ReserveOutcome = check.ok
            ? await this.reservation.reserve({
                  manager,
                  force: false,
                  booking: {
                      ...base,
                      resourceId: check.slot.resourceId,
                      status: confirmed ? "confirmed" : "requested",
                      holdsSlot: true,
                      conflictNote: "",
                  },
              })
            : { kind: "full" }
        if (first.kind === "reserved") {
            if (confirmed) {
                await this.reminders.schedule({
                    manager,
                    workspaceId: args.request.workspaceId,
                    bookingId: first.id,
                    startMs,
                    nowMs: args.nowMs,
                    defaultHours: model.settings.reminderHours,
                })
            }
            return { kind: "placed", id: first.id, free: true }
        }
        const fallback = fallbackResource(model.resources, service.resourceKind)
        if (fallback === null) return { kind: "no_resource" }
        const parked = await this.reservation.reserve({
            manager,
            force: false,
            booking: {
                ...base,
                resourceId: fallback.id,
                status: "requested",
                holdsSlot: false,
                conflictNote: check.ok ? "full" : check.why,
            },
        })
        return parked.kind === "reserved" ? { kind: "placed", id: parked.id, free: false } : { kind: "no_resource" }
    }

    private codeFor(free: boolean, autoConfirm: boolean): PublicBookCode {
        if (!free) return "received_taken"
        return autoConfirm ? "confirmed" : "received_free"
    }

    private repeatedAnswer(row: KeyedBookingRow, serviceName: string, startMs: number): PublicBookResult {
        if (row.status === "confirmed")
            return this.answer("confirmed", "confirmed", true, serviceName, bookingIsoOf(startMs), [], row.id)
        return this.answer(
            row.holds_slot ? "received_free" : "received_taken",
            "waiting",
            true,
            serviceName,
            bookingIsoOf(startMs),
            [],
            row.id,
        )
    }

    private invalid(code: PublicBookCode): PublicBookResult {
        return this.answer(code, "invalid", false, "", "", [], null)
    }

    private answer(
        code: PublicBookCode,
        state: PublicBookResult["state"],
        ok: boolean,
        serviceName: string,
        startIso: string,
        alternatives: ReadonlyArray<string>,
        bookingId: string | null,
    ): PublicBookResult {
        return { ok, state, code, serviceName, startIso, alternatives, bookingId }
    }
}
