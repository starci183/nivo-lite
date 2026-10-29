import { Injectable } from "@nestjs/common"
import { Between, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { WorkItemsService } from "@modules/domain/work-items"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { Env, Setup, Shift } from "./shifts.contracts"
import type { ShiftWithSchedule } from "./shifts-records.contracts"
import {
    ShiftsAvailabilityEntity,
    ShiftsCoverageEntity,
    ShiftsLeaveRequestEntity,
    ShiftsPositionEntity,
    ShiftsScheduleEntity,
    ShiftsSettingsEntity,
    ShiftsShiftEntity,
    ShiftsStaffEntity,
    ShiftsStaffPayEntity,
    ShiftsSwapRequestEntity,
} from "./persistence/entities"
import { selectShiftWithScheduleColumns } from "./persistence/shifts-shift.query"
import {
    toAvail,
    toBlock,
    toLeave,
    toPosition,
    toSettings,
    toShift,
    toStaff,
    priorOf,
} from "./policies/row-mappers.policy"
import { addDays } from "./policies/time.policy"

/** The most positions one read answers. */
const POSITIONS_MAX = 200
/** The most people, and pay rows, one read answers. */
const STAFF_MAX = 500
/** The most coverage blocks one read answers. */
const COVERAGE_MAX = 1000
/** The most approved availability statements one read answers. */
const AVAILABILITY_MAX = 2000
/** The most approved leaves one read answers. */
const LEAVES_MAX = 500
/** The most shifts of one schedule one read answers. */
const SCHEDULE_SHIFTS_MAX = 1000
/** The most shifts of the day before a week one read answers. */
const PRIOR_SHIFTS_MAX = 500
/** The most shifts of a range of days one read answers. */
const RANGE_SHIFTS_MAX = 2000
/** The most shifts of one person in a range of days one read answers. */
const STAFF_SHIFTS_MAX = 500

@Injectable()
/** Reads what the shifts rules run against: the setup of the shop, the approved availability and leave, and the shifts of a schedule. */
export class ShiftsDataService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly workItems: WorkItemsService,
    ) {}

    /** The positions, people (with pay when asked), coverage blocks and rules of a workspace. */
    async loadSetup(workspaceId: string, withPay: boolean): Promise<Setup> {
        const [positions, staff, pay, blocks, settings] = await Promise.all([
            this.entityManager.find(ShiftsPositionEntity, {
                select: { id: true, name: true, color: true },
                where: { workspaceId, active: true },
                order: { sortOrder: "ASC", createdAt: "ASC" },
                take: POSITIONS_MAX,
            }),
            this.entityManager.find(ShiftsStaffEntity, {
                where: { workspaceId },
                order: { createdAt: "ASC" },
                take: STAFF_MAX,
            }),
            withPay
                ? this.entityManager.find(ShiftsStaffPayEntity, {
                      select: { staffId: true, hourlyWageVnd: true },
                      where: { workspaceId },
                      take: STAFF_MAX,
                  })
                : Promise.resolve<Array<ShiftsStaffPayEntity>>([]),
            this.entityManager.find(ShiftsCoverageEntity, {
                where: { workspaceId },
                order: { weekday: "ASC", startTime: "ASC" },
                take: COVERAGE_MAX,
            }),
            this.entityManager.findOne(ShiftsSettingsEntity, { where: { workspaceId } }),
        ])
        const wages = new Map(pay.map((row) => [row.staffId, Number(row.hourlyWageVnd) || 0]))
        return {
            positions: positions.map(toPosition),
            staff: staff.map((row) => toStaff(row, wages.get(row.id) ?? 0)),
            blocks: blocks.map(toBlock),
            settings: toSettings(settings ?? undefined),
        }
    }

    /** The environment the rules run in: approved availability and leave, and the work of the day before the week. */
    async loadEnv(workspaceId: string, monday: string, setup: Setup): Promise<Env> {
        const [availability, leaves, prior] = await Promise.all([
            this.entityManager.find(ShiftsAvailabilityEntity, {
                where: { workspaceId, status: "approved" },
                take: AVAILABILITY_MAX,
            }),
            this.entityManager.find(ShiftsLeaveRequestEntity, {
                where: {
                    workspaceId,
                    status: "approved",
                    toDate: MoreThanOrEqual(monday),
                    fromDate: LessThanOrEqual(addDays(monday, 6)),
                },
                take: LEAVES_MAX,
            }),
            this.entityManager.find(ShiftsShiftEntity, {
                where: {
                    workspaceId,
                    shiftDate: addDays(monday, -1),
                    status: In(["published", "swapped"]),
                    staffId: Not(IsNull()),
                },
                take: PRIOR_SHIFTS_MAX,
            }),
        ])
        return {
            staff: new Map(setup.staff.map((person) => [person.id, person])),
            avail: availability.map(toAvail),
            leaves: leaves.map(toLeave),
            prior: priorOf(prior),
            overtimeHoursWeek: setup.settings.overtimeHoursWeek,
        }
    }

    /** The shifts of a schedule that were not cancelled, earliest first. */
    async scheduleShifts(workspaceId: string, scheduleId: string): Promise<Array<Shift>> {
        const rows = await this.entityManager.find(ShiftsShiftEntity, {
            where: { workspaceId, scheduleId, status: Not("cancelled") },
            order: { shiftDate: "ASC", startTime: "ASC" },
            take: SCHEDULE_SHIFTS_MAX,
        })
        return rows.map(toShift)
    }

    /**
     * The shifts profile of a member: linked directly by account, or through the member's staff row. The oldest active one wins; null
     * when the member has none. A member without a staff row matches by account only.
     */
    async profileIdOfMember(workspaceId: string, userId: string, staffRowId: string | null): Promise<string | null> {
        const own = { workspaceId, active: true }
        const row = await this.entityManager.findOne(ShiftsStaffEntity, {
            select: { id: true },
            where: [{ ...own, userId }, ...(staffRowId === null ? [] : [{ ...own, staffId: staffRowId }])],
            order: { createdAt: "ASC" },
        })
        return row?.id ?? null
    }

    /** One shift with the state of its schedule, or undefined. */
    shiftRow(workspaceId: string, shiftId: string): Promise<ShiftWithSchedule | undefined> {
        return selectShiftWithScheduleColumns(
            this.entityManager.createQueryBuilder(ShiftsShiftEntity, "s"),
            workspaceId,
        )
            .andWhere("s.id = :shiftId", { shiftId })
            .limit(1)
            .getRawOne<ShiftWithSchedule>()
    }

    /** One schedule, or undefined. */
    async scheduleRow(workspaceId: string, scheduleId: string): Promise<ShiftsScheduleEntity | undefined> {
        const row = await this.entityManager.findOne(ShiftsScheduleEntity, { where: { workspaceId, id: scheduleId } })
        return row ?? undefined
    }

    /** The shifts of everyone in a range of days that are in one of the statuses. */
    async rangeShifts(
        workspaceId: string,
        from: string,
        to: string,
        statuses: ReadonlyArray<string>,
    ): Promise<Array<Shift>> {
        const rows = await this.entityManager.find(ShiftsShiftEntity, {
            where: {
                workspaceId,
                shiftDate: Between(from, to),
                status: In([...statuses]),
                staffId: Not(IsNull()),
            },
            take: RANGE_SHIFTS_MAX,
        })
        return rows.map(toShift)
    }

    /** The shifts one person works in a range of days that are in one of the statuses. */
    async staffShifts(
        workspaceId: string,
        staffId: string,
        from: string,
        to: string,
        statuses: ReadonlyArray<string>,
    ): Promise<Array<Shift>> {
        const rows = await this.entityManager.find(ShiftsShiftEntity, {
            where: { workspaceId, staffId, shiftDate: Between(from, to), status: In([...statuses]) },
            take: STAFF_SHIFTS_MAX,
        })
        return rows.map(toShift)
    }

    /** The profile of the member in the shifts of the workspace, or null when the member has none. */
    profileOf(workspaceId: string, userId: string): Promise<string | null> {
        return this.profileIdOfMember(workspaceId, userId, null)
    }

    /** One leave request, or undefined. */
    async leaveRow(workspaceId: string, leaveId: string): Promise<ShiftsLeaveRequestEntity | undefined> {
        const row = await this.entityManager.findOne(ShiftsLeaveRequestEntity, { where: { workspaceId, id: leaveId } })
        return row ?? undefined
    }

    /** One swap or claim request, or undefined. */
    async swapRow(workspaceId: string, swapId: string): Promise<ShiftsSwapRequestEntity | undefined> {
        const row = await this.entityManager.findOne(ShiftsSwapRequestEntity, { where: { workspaceId, id: swapId } })
        return row ?? undefined
    }

    /** How many times an action was asked for one subject, so a repeated ask gets a fresh dedupe key. */
    askAttempts(workspaceId: string, action: string, prefix: string): Promise<number> {
        return this.workItems.countByDedupePrefix(workspaceId, action, prefix)
    }
}
