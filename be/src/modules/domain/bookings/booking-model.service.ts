import { Injectable } from "@nestjs/common"
import { In, LessThan, MoreThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { BookingExceptionsReadService } from "@modules/domain/booking-exceptions"
import { BookingHoursReadService } from "@modules/domain/booking-hours"
import { BookingResourcesReadService } from "@modules/domain/booking-resources"
import { BookingServicesReadService } from "@modules/domain/booking-services"
import { BookingSettingsReadService } from "@modules/domain/booking-settings"
import { ShiftsLeaveReadService } from "@modules/domain/shifts"
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

const SPANS_LIMIT = 5000

@Injectable()
/** Reads the calendar of a workspace: its settings, services, resources, hours, exceptions and the spans already taken. */
export class BookingModelService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly leave: ShiftsLeaveReadService,
        private readonly settingsRead: BookingSettingsReadService,
        private readonly servicesRead: BookingServicesReadService,
        private readonly resourcesRead: BookingResourcesReadService,
        private readonly hoursRead: BookingHoursReadService,
        private readonly exceptionsRead: BookingExceptionsReadService,
    ) {}

    /** The settings of a workspace, the defaults when it never saved any. */
    async settings(workspaceId: string): Promise<BookingSettings> {
        const saved = await this.settingsRead.of(workspaceId)
        return saved === null ? DEFAULT_SETTINGS : toSettings(saved)
    }

    /** Everything the planner needs about a workspace. */
    async model(workspaceId: string): Promise<BookingModel> {
        const [settings, services, resources, hours, exceptions] = await Promise.all([
            this.settings(workspaceId),
            this.servicesRead.catalogue(workspaceId),
            this.resourcesRead.catalogue(workspaceId),
            this.hoursRead.week(workspaceId),
            this.exceptionsRead.list(workspaceId, null),
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
    private async leaveDays(workspaceId: string, from: string, to: string): Promise<Array<LeaveDayFacts>> {
        const linked = await this.resourcesRead.staffLinked(workspaceId)
        const staffIds = [
            ...new Set(linked.flatMap((resource) => (resource.staffId === null ? [] : [resource.staffId]))),
        ]
        const leaves = await this.leave.approvedLeave({ workspaceId, staffIds, from, to })
        return leaves.flatMap((leave) =>
            linked
                .filter((resource) => resource.staffId === leave.staffId)
                .map((resource) => ({
                    resource_id: resource.id,
                    leave_staff: leave.staffId,
                    from_date: leave.fromDate,
                    to_date: leave.toDate,
                })),
        )
    }
}
