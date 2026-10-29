import type { BookingExceptionEntity } from "@modules/domain/booking-exceptions"
import type { BookingHourEntity } from "@modules/domain/booking-hours"
import type { BookingResourceEntity } from "@modules/domain/booking-resources"
import type { BookingServiceEntity } from "@modules/domain/booking-services"
import type { BookingSettingEntity } from "@modules/domain/booking-settings"
import type {
    BookingBoardEntry,
    BookingBoardException,
    BookingBoardResource,
    BookingBoardServiceItem,
    BookingBoardWait,
} from "./booking-board.contracts"
import type { BoardBookingFacts, BoardWaitFacts, LeaveDayFacts } from "./booking-facts.contracts"
import type {
    BookableService,
    BookingResource,
    BookingSettings,
    DateException,
    TakenSpan,
    WeeklyHours,
} from "./bookings.contracts"
import type { BookingEntity } from "./persistence/entities"
import type { FigureRow, LeaveDay } from "./policies/booking-rules.policy"
import { hhmmOf, localDate, localHhmm } from "./policies/zoned-time.policy"

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR
const minutesOf = (clock: string): number => Number(clock.slice(0, 2)) * MINUTES_PER_HOUR + Number(clock.slice(3, 5))

/** A bigint column that may be null, as the number the contracts carry. */
export const amountOf = (value: string | null): number | null => (value === null ? null : Number(value))

/** The settings a row holds. */
export const toSettings = (entity: BookingSettingEntity): BookingSettings => ({
    timezone: entity.timezone,
    slotStepMin: entity.slotStepMin,
    minLeadMin: entity.minLeadMin,
    maxAdvanceDays: entity.maxAdvanceDays,
    cancelWindowHours: entity.cancelWindowHours,
    depositPct: entity.depositPct,
    lateCancelFeePct: entity.lateCancelFeePct,
    noShowFeeVnd: Number(entity.noShowFeeVnd),
    autoConfirm: entity.autoConfirm,
    handoffOrder: entity.handoffOrder,
    reminderHours: entity.reminderHours,
    publicEnabled: entity.publicEnabled,
    publicSlug: entity.publicSlug,
    publicNote: entity.publicNote,
    address: entity.address,
})

/** The service the owner sees. */
export const toBookable = (entity: BookingServiceEntity): BookableService => ({
    id: entity.id,
    name: entity.name,
    description: entity.description,
    durationMin: entity.durationMin,
    bufferMin: entity.bufferMin,
    priceVnd: amountOf(entity.priceVnd),
    resourceKind: entity.resourceKind,
    active: entity.active,
})

/** The resource as the planner sees it. */
export const toResource = (entity: BookingResourceEntity): BookingResource => ({
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    capacity: entity.capacity,
    active: entity.active,
    sort: entity.sortOrder,
})

/** The weekly window as the planner sees it. */
export const toWeeklyHours = (entity: BookingHourEntity): WeeklyHours => ({
    resourceId: entity.resourceId,
    weekday: entity.weekday,
    start: hhmmOf(entity.startTime),
    end: hhmmOf(entity.endTime),
})

/** The exception as the planner sees it. */
export const toDateException = (entity: BookingExceptionEntity): DateException => ({
    resourceId: entity.resourceId,
    date: entity.onDate,
    closed: entity.closed,
    start: entity.startTime === null ? null : hhmmOf(entity.startTime),
    end: entity.endTime === null ? null : hhmmOf(entity.endTime),
})

/** The held span as the planner sees it. */
export const toTakenSpan = (entity: BookingEntity): TakenSpan => ({
    id: entity.id,
    resourceId: entity.resourceId,
    startMs: entity.startAt.getTime(),
    blockEndMs: entity.blockEndAt.getTime(),
    partySize: entity.partySize,
})

/** The leave days as the rules read them. */
export const toLeaveDay = (facts: LeaveDayFacts): LeaveDay => ({
    resourceId: facts.resource_id,
    staffId: facts.leave_staff,
    fromDate: facts.from_date,
    toDate: facts.to_date,
})

/** The booking as the figures read it. */
export const toFigureRow = (entity: BookingEntity): FigureRow => ({
    status: entity.status,
    resourceId: entity.resourceId,
    partySize: entity.partySize,
    startMs: entity.startAt.getTime(),
    endMs: entity.endAt.getTime(),
    priceVnd: amountOf(entity.priceVnd),
})

/** The owner-visible service, including the follow-up rule. */
export const toBoardService = (entity: BookingServiceEntity): BookingBoardServiceItem => ({
    ...toBookable(entity),
    followupDays: entity.followupDays,
})

/** The owner-visible resource, including its display colour and staff link. */
export const toBoardResource = (entity: BookingResourceEntity): BookingBoardResource => ({
    ...toResource(entity),
    color: entity.color,
    staffId: entity.staffId,
})

/** The editable exception, including its stable id and note. */
export const toBoardException = (entity: BookingExceptionEntity): BookingBoardException => ({
    ...toDateException(entity),
    id: entity.id,
    note: entity.note,
})

/** The appointment in the wall-clock coordinates used by the calendar. */
export const toBoardBooking = (facts: BoardBookingFacts, timezone: string): BookingBoardEntry => {
    const date = localDate(facts.start_ms, timezone)
    const startClock = localHhmm(facts.start_ms, timezone)
    const endClock = localDate(facts.end_ms, timezone) === date ? localHhmm(facts.end_ms, timezone) : "24:00"
    return {
        id: facts.id,
        customer: facts.customer_name,
        phone: facts.customer_phone,
        serviceId: facts.service_id,
        service: facts.service_name,
        resourceId: facts.resource_id,
        startMs: facts.start_ms,
        endMs: facts.end_ms,
        date,
        startMin: minutesOf(startClock),
        endMin: endClock === "24:00" ? MINUTES_PER_DAY : minutesOf(endClock),
        startClock: hhmmOf(startClock),
        endClock,
        status: facts.status,
        holdsSlot: facts.holds_slot,
        party: facts.party_size,
        priceVnd: facts.price_vnd,
        depositVnd: facts.deposit_vnd,
        depositStatus: facts.deposit_status,
        feeVnd: facts.cancel_fee_vnd,
        checkedIn: facts.checked_in,
        note: facts.note,
        conflictNote: facts.conflict_note,
        source: facts.source_channel,
        leadId: facts.lead_id,
        reschedules: facts.reschedule_count,
    }
}

/** The waiting customer as shown on the workbench. */
export const toBoardWait = (facts: BoardWaitFacts): BookingBoardWait => ({
    id: facts.id,
    customer: facts.customer_name,
    phone: facts.customer_phone,
    service: facts.service_name,
    fromMs: facts.from_ms,
    toMs: facts.to_ms,
    party: facts.party_size,
    status: facts.status,
})
