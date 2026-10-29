import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BookingExceptionsReadService } from "@modules/domain/booking-exceptions"
import { BookingHoursReadService } from "@modules/domain/booking-hours"
import { BookingResourcesReadService } from "@modules/domain/booking-resources"
import { BookingServicesReadService } from "@modules/domain/booking-services"
import { BookingWaitlistReadService } from "@modules/domain/booking-waitlist"
import type { BookingWaitRecord } from "@modules/domain/booking-waitlist"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { StaffDirectoryService } from "@modules/domain/staff"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingBoard, BookingBoardParams } from "./booking-board.contracts"
import type { BoardBookingFacts, BoardStaffFacts, BoardWaitFacts } from "./booking-facts.contracts"
import {
    toBoardBooking,
    toBoardException,
    toBoardResource,
    toBoardService,
    toBoardWait,
    toWeeklyHours,
} from "./booking-model.mapper"
import { BookingModelService } from "./booking-model.service"
import { BookingOverviewService } from "./booking-overview.service"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"
import { BookingEntity } from "./persistence/entities"
import { addDays, bookingIsoOf, localDate, mondayOf, zonedMs } from "./policies/zoned-time.policy"

const DAY_MS = 86_400_000
const MAX_RANGE_DAYS = 366
const BOOKINGS_LIMIT = 2000
const STAFF_LIMIT = 200
const LOCAL_DATE_PATTERN = /^[1-9]\d{3}-\d{2}-\d{2}$/

const validDate = (date: string): boolean => {
    if (!LOCAL_DATE_PATTERN.test(date)) return false
    const instant = Date.parse(`${date}T00:00:00.000Z`)
    return Number.isFinite(instant) && bookingIsoOf(instant).slice(0, 10) === date
}

/** A waiting customer with the current name of the service, the instants as epoch milliseconds. */
const toWaitFacts = (wait: BookingWaitRecord, serviceName: string): BoardWaitFacts => ({
    id: wait.id,
    customer_name: wait.customerName,
    customer_phone: wait.customerPhone,
    service_name: serviceName,
    from_ms: wait.windowStart.getTime(),
    to_ms: wait.windowEnd.getTime(),
    party_size: wait.partySize,
    status: wait.status,
})

@Injectable()
/** Reads the full booking workbench while retaining the domain's fixed-window figures and calendar statistics. */
export class BookingBoardService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly models: BookingModelService,
        private readonly overview: BookingOverviewService,
        private readonly staff: StaffDirectoryService,
        private readonly servicesRead: BookingServicesReadService,
        private readonly resourcesRead: BookingResourcesReadService,
        private readonly hoursRead: BookingHoursReadService,
        private readonly exceptionsRead: BookingExceptionsReadService,
        private readonly waitlistRead: BookingWaitlistReadService,
    ) {}

    /** Reads every setup and calendar field for an active workspace member. */
    async board(userId: string, params: BookingBoardParams): Promise<BookingBoard> {
        await this.members.require(userId, params.workspaceId)
        const settings = await this.models.settings(params.workspaceId)
        const nowMs = this.clock.now().getTime()
        const timezone = settings.timezone
        const today = localDate(nowMs, timezone)
        const from = params.from ?? mondayOf(today)
        if (!validDate(from)) throw new BookingsError({ code: BookingsErrorCode.InvalidInput })
        const to = params.to ?? addDays(from, 6)
        this.requireRange(from, to)
        const fromAt = new Date(zonedMs(from, "00:00", timezone))
        const toAt = new Date(zonedMs(addDays(to, 1), "00:00", timezone))
        const exceptionsFrom = from < addDays(today, -1) ? from : addDays(today, -1)
        const [services, resources, hours, exceptions, bookings, waitlist, staff, overview] = await Promise.all([
            this.servicesRead.catalogue(params.workspaceId),
            this.resourcesRead.catalogue(params.workspaceId),
            this.hoursRead.week(params.workspaceId),
            this.exceptionsRead.list(params.workspaceId, exceptionsFrom),
            this.boardBookings(params.workspaceId, fromAt, toAt),
            this.boardWaitlist(params.workspaceId),
            this.boardStaff(params.workspaceId),
            this.overview.overview(userId, { workspaceId: params.workspaceId, from, to }),
        ])
        return {
            timezone,
            today,
            nowMs,
            from,
            to,
            settings,
            services: services.map(toBoardService),
            resources: resources.map(toBoardResource),
            hours: hours.map(toWeeklyHours),
            exceptions: exceptions.map(toBoardException),
            bookings: bookings.map((row) => toBoardBooking(row, timezone)),
            waitlist: waitlist.map(toBoardWait),
            staff,
            ...overview,
        }
    }

    /** The complete appointments overlapping a window, with the current name of their service. */
    private async boardBookings(workspaceId: string, from: Date, to: Date): Promise<Array<BoardBookingFacts>> {
        const rows = await this.entityManager
            .createQueryBuilder(BookingEntity, "b")
            .select("b.id", "id")
            .addSelect("b.customerName", "customer_name")
            .addSelect("b.customerPhone", "customer_phone")
            .addSelect("b.serviceId", "service_id")
            .addSelect("b.resourceId", "resource_id")
            .addSelect("CAST(extract(epoch FROM b.startAt) * 1000 AS float8)", "start_ms")
            .addSelect("CAST(extract(epoch FROM b.endAt) * 1000 AS float8)", "end_ms")
            .addSelect("b.status", "status")
            .addSelect("b.holdsSlot", "holds_slot")
            .addSelect("b.partySize", "party_size")
            .addSelect("CAST(b.priceVnd AS float8)", "price_vnd")
            .addSelect("CAST(b.depositVnd AS float8)", "deposit_vnd")
            .addSelect("b.depositStatus", "deposit_status")
            .addSelect("CAST(b.cancelFeeVnd AS float8)", "cancel_fee_vnd")
            .addSelect("(b.checkedInAt IS NOT NULL)", "checked_in")
            .addSelect("b.note", "note")
            .addSelect("b.conflictNote", "conflict_note")
            .addSelect("b.sourceChannel", "source_channel")
            .addSelect("b.leadId", "lead_id")
            .addSelect("b.rescheduleCount", "reschedule_count")
            .where("b.workspaceId = :workspaceId AND b.startAt < :to AND b.endAt > :from", { workspaceId, from, to })
            .orderBy("b.startAt", "ASC")
            .addOrderBy("b.id", "ASC")
            .limit(BOOKINGS_LIMIT)
            .getRawMany<Omit<BoardBookingFacts, "service_name">>()
        const names = await this.servicesRead.namesOf(workspaceId, [...new Set(rows.map((row) => row.service_id))])
        return rows.map((row) => ({ ...row, service_name: names.get(row.service_id) ?? "" }))
    }

    /** The waiting customers with the current name of their service. */
    private async boardWaitlist(workspaceId: string): Promise<Array<BoardWaitFacts>> {
        const waiting = await this.waitlistRead.open(workspaceId)
        const names = await this.servicesRead.namesOf(workspaceId, [...new Set(waiting.map((wait) => wait.serviceId))])
        return waiting.map((wait) => toWaitFacts(wait, names.get(wait.serviceId) ?? ""))
    }

    /** The active staff that resources can be linked to, by name. */
    private async boardStaff(workspaceId: string): Promise<Array<BoardStaffFacts>> {
        const staff = await this.staff.list(workspaceId)
        return staff
            .map(({ id, name }) => ({ id, name }))
            .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
            .slice(0, STAFF_LIMIT)
    }

    private requireRange(from: string, to: string): void {
        const spanDays = (Date.parse(to) - Date.parse(from)) / DAY_MS + 1
        if (!validDate(to) || spanDays < 1 || spanDays > MAX_RANGE_DAYS || !validDate(addDays(to, 1))) {
            throw new BookingsError({ code: BookingsErrorCode.InvalidInput })
        }
    }
}
