import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { BookingModelService } from "./booking-model.service"
import type { BookingOverview, OverviewParams } from "./bookings.contracts"
import {
    SELECT_DEPOSITS_DUE,
    SELECT_FINISHED_COUNTS,
    SELECT_OVERLAPPING_BOOKINGS,
    SELECT_WINDOW_BOOKINGS,
} from "./persistence/booking-overview.sql"
import { toFigureRow } from "./persistence/booking.rows"
import type { DepositsRow, FinishedCountRow, WindowRow } from "./persistence/booking.rows"
import { utilisation } from "./policies/availability.policy"
import { noShowShare, startingBetween, summariseRange, weightedUtilisation } from "./policies/booking-rules.policy"
import { addDays, isoOf, localDate, mondayOf, zonedMs } from "./policies/zoned-time.policy"

const DAY_MS = 86_400_000
const FINISHED_WINDOW_DAYS = 30

@Injectable()
/** The figures of the booking workbench: today, this week, the last 30 days, the deposits still due and the statistics of a date range. */
export class BookingOverviewService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly models: BookingModelService,
    ) {}

    /** The ribbon figures (today, this week, the last 30 days) and the statistics of a date range. */
    async overview(userId: string, params: OverviewParams): Promise<BookingOverview> {
        await this.members.require(userId, params.workspaceId)
        const model = await this.models.model(params.workspaceId)
        const timeZone = model.settings.timezone
        const nowMs = this.clock.now().getTime()
        const today = localDate(nowMs, timeZone)
        const monday = mondayOf(today)
        const sunday = addDays(monday, 6)
        const dayStart = zonedMs(today, "00:00", timeZone)
        const dayEnd = zonedMs(addDays(today, 1), "00:00", timeZone)
        const weekStart = zonedMs(monday, "00:00", timeZone)
        const weekEnd = zonedMs(addDays(sunday, 1), "00:00", timeZone)
        const instance = params.installationId ?? null
        const [week, finished, deposits, range] = await Promise.all([
            this.entityManager.query<Array<WindowRow>>(SELECT_WINDOW_BOOKINGS, [
                params.workspaceId,
                isoOf(weekStart),
                isoOf(weekEnd),
                instance,
            ]),
            this.entityManager.query<Array<FinishedCountRow>>(SELECT_FINISHED_COUNTS, [
                params.workspaceId,
                isoOf(nowMs - FINISHED_WINDOW_DAYS * DAY_MS),
                isoOf(nowMs),
                instance,
            ]),
            this.entityManager.query<Array<DepositsRow>>(SELECT_DEPOSITS_DUE, [params.workspaceId, instance]),
            this.entityManager.query<Array<WindowRow>>(SELECT_OVERLAPPING_BOOKINGS, [
                params.workspaceId,
                isoOf(zonedMs(params.from, "00:00", timeZone)),
                isoOf(zonedMs(addDays(params.to, 1), "00:00", timeZone)),
            ]),
        ])
        const weekRows = week.map(toFigureRow)
        const weekly = utilisation(
            model.resources,
            model.hours,
            model.exceptions,
            summariseRange(weekRows).bookedByResource,
            monday,
            sunday,
            timeZone,
        )
        const finishedCount = (status: string): number =>
            finished.filter((row) => row.status === status).reduce((sum, row) => sum + row.total, 0)
        const summary = summariseRange(range.map(toFigureRow))
        return {
            figures: {
                bookingsToday: startingBetween(weekRows, dayStart, dayEnd),
                noShowPct30d: noShowShare(finishedCount("done"), finishedCount("no_show")),
                finished30d: finishedCount("done") + finishedCount("no_show"),
                utilisationPct: weightedUtilisation(weekly),
                depositsPending: deposits.reduce((sum, row) => sum + row.total, 0),
                depositsPendingVnd: deposits.reduce((sum, row) => sum + row.amount_vnd, 0),
            },
            stats: {
                byResource: utilisation(
                    model.resources,
                    model.hours,
                    model.exceptions,
                    summary.bookedByResource,
                    params.from,
                    params.to,
                    timeZone,
                ),
                byStatus: summary.byStatus,
                noShowPct: noShowShare(summary.byStatus.done ?? 0, summary.byStatus.no_show ?? 0) ?? 0,
                doneRevenueVnd: summary.doneRevenueVnd,
                total: range.length,
            },
        }
    }
}
