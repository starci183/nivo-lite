import { Injectable } from "@nestjs/common"
import { In, LessThan, MoreThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { BookingExceptionEntity } from "@modules/domain/booking-exceptions"
import { BookingHourEntity } from "@modules/domain/booking-hours"
import { BookingResourceEntity } from "@modules/domain/booking-resources"
import { BookingServiceEntity } from "@modules/domain/booking-services"
import { BookingSettingEntity } from "@modules/domain/booking-settings"
import { ShiftsLeaveRequestEntity, ShiftsStaffEntity } from "@modules/domain/shifts"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { LeaveDayFacts } from "./booking-facts.contracts"
import {
    toBookable,
    toDateException,
    toLeaveDay,
    toResource,
    toSettings,
    toTakenSpan,
    toWeeklyHours,
} from "./booking-model.mapper"
import { ACTIVE_STATUSES, DEFAULT_SETTINGS } from "./bookings.contracts"
import type { BookingModel, BookingSettings, TakenSpan } from "./bookings.contracts"
import { BookingEntity } from "./persistence/entities"
import { leaveBlocks } from "./policies/booking-rules.policy"
import { localDate } from "./policies/zoned-time.policy"

const SERVICES_LIMIT = 200
const RESOURCES_LIMIT = 200
const HOURS_LIMIT = 2000
const EXCEPTIONS_LIMIT = 1000
const SPANS_LIMIT = 5000
const LEAVE_LIMIT = 500

@Injectable()
/** Reads the calendar of a workspace: its settings, services, resources, hours, exceptions and the spans already taken. */
export class BookingModelService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The settings of a workspace, the defaults when it never saved any. */
    async settings(workspaceId: string): Promise<BookingSettings> {
        const saved = await this.entityManager.findOneBy(BookingSettingEntity, { workspaceId })
        return saved === null ? DEFAULT_SETTINGS : toSettings(saved)
    }

    /** Everything the planner needs about a workspace. */
    async model(workspaceId: string): Promise<BookingModel> {
        const [settings, services, resources, hours, exceptions] = await Promise.all([
            this.settings(workspaceId),
            this.entityManager.find(BookingServiceEntity, {
                where: { workspaceId },
                order: { sortOrder: "ASC", createdAt: "ASC" },
                take: SERVICES_LIMIT,
            }),
            this.entityManager.find(BookingResourceEntity, {
                where: { workspaceId },
                order: { sortOrder: "ASC", createdAt: "ASC" },
                take: RESOURCES_LIMIT,
            }),
            this.entityManager.find(BookingHourEntity, { where: { workspaceId }, take: HOURS_LIMIT }),
            this.entityManager.find(BookingExceptionEntity, { where: { workspaceId }, take: EXCEPTIONS_LIMIT }),
        ])
        return {
            settings,
            services: services.map(toBookable),
            resources: resources.map(toResource),
            hours: hours.map(toWeeklyHours),
            exceptions: exceptions.map(toDateException),
        }
    }

    /** The bookings that hold a resource between two instants, plus the whole-day blocks of approved leave. */
    async spans(
        workspaceId: string,
        fromMs: number,
        toMs: number,
        timeZone: string,
    ): Promise<ReadonlyArray<TakenSpan>> {
        const [held, leaves] = await Promise.all([
            this.entityManager.find(BookingEntity, {
                select: { id: true, resourceId: true, partySize: true, startAt: true, blockEndAt: true },
                where: {
                    workspaceId,
                    holdsSlot: true,
                    status: In(ACTIVE_STATUSES),
                    startAt: LessThan(new Date(toMs)),
                    blockEndAt: MoreThan(new Date(fromMs)),
                },
                take: SPANS_LIMIT,
            }),
            this.leaveDays(workspaceId, localDate(fromMs, timeZone), localDate(toMs, timeZone)),
        ])
        return [...held.map(toTakenSpan), ...leaveBlocks(leaves.map(toLeaveDay), timeZone)]
    }

    /** The approved leave days of staff linked to a resource that touch two local dates. */
    private leaveDays(workspaceId: string, from: string, to: string): Promise<Array<LeaveDayFacts>> {
        return this.entityManager
            .createQueryBuilder(BookingResourceEntity, "r")
            .select("r.id", "resource_id")
            .addSelect("l.staff_id", "leave_staff")
            .addSelect("CAST(l.from_date AS text)", "from_date")
            .addSelect("CAST(l.to_date AS text)", "to_date")
            .innerJoin(ShiftsStaffEntity, "p", "p.staff_id = r.staffId AND p.workspace_id = r.workspaceId")
            .innerJoin(ShiftsLeaveRequestEntity, "l", "l.staff_id = p.id AND l.workspace_id = r.workspaceId")
            .where("r.workspaceId = :workspaceId", { workspaceId })
            .andWhere(
                "l.status = 'approved' AND l.from_date <= CAST(:to AS date) AND l.to_date >= CAST(:from AS date)",
                {
                    from,
                    to,
                },
            )
            .limit(LEAVE_LIMIT)
            .getRawMany<LeaveDayFacts>()
    }
}
