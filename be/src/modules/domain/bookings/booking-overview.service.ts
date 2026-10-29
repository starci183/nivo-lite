import { Injectable } from "@nestjs/common"
import { And, LessThan, MoreThan, MoreThanOrEqual } from "typeorm"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { DepositsDueFacts, FinishedCountFacts } from "./booking-facts.contracts"
import { toFigureRow } from "./booking-model.mapper"
import { BookingModelService } from "./booking-model.service"
import { ACTIVE_STATUSES } from "./bookings.contracts"
import type { BookingOverview, OverviewParams } from "./bookings.contracts"
import { BookingEntity } from "./persistence/entities"
import { utilisation } from "./policies/availability.policy"
import { noShowShare, startingBetween, summariseRange, weightedUtilisation } from "./policies/booking-rules.policy"
import { addDays, localDate, mondayOf, zonedMs } from "./policies/zoned-time.policy"

const DAY_MS = 86_400_000
const FINISHED_WINDOW_DAYS = 30
const WINDOW_LIMIT = 5000
const FIGURE_COLUMNS = { status: true, resourceId: true, partySize: true, priceVnd: true, startAt: true, endAt: true }

/** The instance filter of a window read: none for every instance, never a null that TypeORM would ignore silently. */
const instanceOf = (instance: string | null): FindOptionsWhere<BookingEntity> =>
    instance === null ? {} : { installationId: instance }

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
            this.entityManager.find(BookingEntity, {
                select: FIGURE_COLUMNS,
                where: {
                    workspaceId: params.workspaceId,
                    startAt: And(MoreThanOrEqual(new Date(weekStart)), LessThan(new Date(weekEnd))),
                    ...instanceOf(instance),
                },
                take: WINDOW_LIMIT,
            }),
            this.finishedCounts(params.workspaceId, nowMs - FINISHED_WINDOW_DAYS * DAY_MS, nowMs, instance),
            this.depositsDue(params.workspaceId, instance),
            this.entityManager.find(BookingEntity, {
                select: FIGURE_COLUMNS,
                where: {
                    workspaceId: params.workspaceId,
                    startAt: LessThan(new Date(zonedMs(addDays(params.to, 1), "00:00", timeZone))),
                    endAt: MoreThan(new Date(zonedMs(params.from, "00:00", timeZone))),
                },
                take: WINDOW_LIMIT,
            }),
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

    private finishedCounts(
        workspaceId: string,
        fromMs: number,
        toMs: number,
        instance: string | null,
    ): Promise<Array<FinishedCountFacts>> {
        const counts = this.entityManager
            .createQueryBuilder(BookingEntity, "b")
            .select("b.status", "status")
            .addSelect("CAST(count(*) AS int)", "total")
            .where("b.workspaceId = :workspaceId", { workspaceId })
            .andWhere("b.status IN ('done', 'no_show')")
            .andWhere("b.startAt >= :from AND b.startAt < :to", { from: new Date(fromMs), to: new Date(toMs) })
        if (instance !== null) counts.andWhere("b.installationId = :instance", { instance })
        return counts.groupBy("b.status").limit(2).getRawMany<FinishedCountFacts>()
    }

    private async depositsDue(workspaceId: string, instance: string | null): Promise<Array<DepositsDueFacts>> {
        const due = this.entityManager
            .createQueryBuilder(BookingEntity, "b")
            .select("CAST(count(*) AS int)", "total")
            .addSelect("CAST(COALESCE(sum(b.depositVnd), 0) AS float8)", "amount_vnd")
            .where("b.workspaceId = :workspaceId AND b.depositStatus = 'due'", { workspaceId })
            .andWhere("b.status IN (:...open)", { open: ACTIVE_STATUSES })
        if (instance !== null) due.andWhere("b.installationId = :instance", { instance })
        const total = await due.getRawOne<DepositsDueFacts>()
        return total === undefined ? [] : [total]
    }
}
