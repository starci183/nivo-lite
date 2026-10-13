import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingBoard, BookingBoardParams } from "./booking-board.contracts"
import { BookingModelService } from "./booking-model.service"
import { BookingOverviewService } from "./booking-overview.service"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"
import {
    toBoardBooking,
    toBoardException,
    toBoardResource,
    toBoardService,
    toBoardWait,
} from "./persistence/booking-board.rows"
import type {
    BoardBookingRow,
    BoardExceptionRow,
    BoardResourceRow,
    BoardStaffRow,
    BoardWaitRow,
} from "./persistence/booking-board.rows"
import {
    SELECT_BOARD_BOOKINGS,
    SELECT_BOARD_EXCEPTIONS,
    SELECT_BOARD_RESOURCES,
    SELECT_BOARD_STAFF,
    SELECT_BOARD_WAITLIST,
} from "./persistence/booking-board.sql"
import { SELECT_HOURS, SELECT_SERVICES } from "./persistence/booking-model.sql"
import { toWeeklyHours } from "./persistence/booking.rows"
import type { HoursRow, ServiceRow } from "./persistence/booking.rows"
import { addDays, isoOf, localDate, mondayOf, zonedMs } from "./policies/zoned-time.policy"

const DAY_MS = 86_400_000
const MAX_RANGE_DAYS = 366
const LOCAL_DATE_PATTERN = /^[1-9]\d{3}-\d{2}-\d{2}$/

const validDate = (date: string): boolean => {
    if (!LOCAL_DATE_PATTERN.test(date)) return false
    const instant = Date.parse(`${date}T00:00:00.000Z`)
    return Number.isFinite(instant) && isoOf(instant).slice(0, 10) === date
}

@Injectable()
/** Reads the full booking workbench while retaining the domain's fixed-window figures and calendar statistics. */
export class BookingBoardService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly models: BookingModelService,
        private readonly overview: BookingOverviewService,
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
        const fromIso = isoOf(zonedMs(from, "00:00", timezone))
        const toIso = isoOf(zonedMs(addDays(to, 1), "00:00", timezone))
        const exceptionsFrom = from < addDays(today, -1) ? from : addDays(today, -1)
        const [services, resources, hours, exceptions, bookings, waitlist, staff, overview] = await Promise.all([
            this.entityManager.query<Array<ServiceRow>>(SELECT_SERVICES, [params.workspaceId]),
            this.entityManager.query<Array<BoardResourceRow>>(SELECT_BOARD_RESOURCES, [params.workspaceId]),
            this.entityManager.query<Array<HoursRow>>(SELECT_HOURS, [params.workspaceId]),
            this.entityManager.query<Array<BoardExceptionRow>>(SELECT_BOARD_EXCEPTIONS, [
                params.workspaceId,
                exceptionsFrom,
            ]),
            this.entityManager.query<Array<BoardBookingRow>>(SELECT_BOARD_BOOKINGS, [
                params.workspaceId,
                fromIso,
                toIso,
            ]),
            this.entityManager.query<Array<BoardWaitRow>>(SELECT_BOARD_WAITLIST, [params.workspaceId]),
            this.entityManager.query<Array<BoardStaffRow>>(SELECT_BOARD_STAFF, [params.workspaceId]),
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

    private requireRange(from: string, to: string): void {
        const spanDays = (Date.parse(to) - Date.parse(from)) / DAY_MS + 1
        if (!validDate(to) || spanDays < 1 || spanDays > MAX_RANGE_DAYS || !validDate(addDays(to, 1))) {
            throw new BookingsError({ code: BookingsErrorCode.InvalidInput })
        }
    }
}
