import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingModel, BookingSettings, TakenSpan } from "./bookings.contracts"
import {
    SELECT_EXCEPTIONS,
    SELECT_HELD_SPANS,
    SELECT_HOURS,
    SELECT_LEAVE_DAYS,
    SELECT_RESOURCES,
    SELECT_SERVICES,
    SELECT_SETTINGS,
} from "./persistence/booking-model.sql"
import {
    DEFAULT_SETTINGS,
    toBookable,
    toDateException,
    toLeaveDay,
    toResource,
    toSettings,
    toTakenSpan,
    toWeeklyHours,
} from "./persistence/booking.rows"
import type {
    ExceptionRow,
    HoursRow,
    LeaveDayRow,
    ResourceRow,
    ServiceRow,
    SettingsRow,
    SpanRow,
} from "./persistence/booking.rows"
import { leaveBlocks } from "./policies/booking-rules.policy"
import { localDate } from "./policies/zoned-time.policy"

@Injectable()
/** Reads the calendar of a workspace: its settings, services, resources, hours, exceptions and the spans already taken. */
export class BookingModelService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The settings of a workspace, the defaults when it never saved any. */
    async settings(workspaceId: string): Promise<BookingSettings> {
        const [row] = await this.entityManager.query<Array<SettingsRow>>(SELECT_SETTINGS, [workspaceId])
        return row === undefined ? DEFAULT_SETTINGS : toSettings(row)
    }

    /** Everything the planner needs about a workspace. */
    async model(workspaceId: string): Promise<BookingModel> {
        const [settings, services, resources, hours, exceptions] = await Promise.all([
            this.settings(workspaceId),
            this.entityManager.query<Array<ServiceRow>>(SELECT_SERVICES, [workspaceId]),
            this.entityManager.query<Array<ResourceRow>>(SELECT_RESOURCES, [workspaceId]),
            this.entityManager.query<Array<HoursRow>>(SELECT_HOURS, [workspaceId]),
            this.entityManager.query<Array<ExceptionRow>>(SELECT_EXCEPTIONS, [workspaceId]),
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
            this.entityManager.query<Array<SpanRow>>(SELECT_HELD_SPANS, [
                workspaceId,
                new Date(fromMs).toISOString(),
                new Date(toMs).toISOString(),
            ]),
            this.entityManager.query<Array<LeaveDayRow>>(SELECT_LEAVE_DAYS, [
                workspaceId,
                localDate(fromMs, timeZone),
                localDate(toMs, timeZone),
            ]),
        ])
        return [...held.map(toTakenSpan), ...leaveBlocks(leaves.map(toLeaveDay), timeZone)]
    }
}
