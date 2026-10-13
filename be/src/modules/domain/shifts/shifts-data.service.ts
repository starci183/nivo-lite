import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { Env, Setup, Shift } from "./shifts.contracts"
import {
    COUNT_WORK_ASKS,
    SELECT_APPROVED_LEAVES,
    SELECT_AVAILABILITY,
    SELECT_COVERAGE,
    SELECT_LEAVE,
    SELECT_PAY,
    SELECT_POSITIONS,
    SELECT_PROFILE_OF_USER,
    SELECT_PRIOR_SHIFTS,
    SELECT_RANGE_SHIFTS,
    SELECT_SCHEDULE,
    SELECT_SCHEDULE_SHIFTS,
    SELECT_SETTINGS,
    SELECT_SHIFT,
    SELECT_STAFF,
    SELECT_STAFF_SHIFTS,
    SELECT_SWAP,
} from "./persistence/shifts.sql"
import type {
    ShiftsAvailabilityRow,
    ShiftsCoverageRow,
    ShiftsIdRow,
    ShiftsLeaveRow,
    ShiftsPayRow,
    ShiftsPositionRow,
    ShiftsScheduleRow,
    ShiftsSettingsRow,
    ShiftsShiftRow,
    ShiftsStaffRow,
    ShiftsSwapRow,
} from "./persistence/shifts.rows"
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

@Injectable()
/** Reads what the shifts rules run against: the setup of the shop, the approved availability and leave, and the shifts of a schedule. */
export class ShiftsDataService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The positions, people (with pay when asked), coverage blocks and rules of a workspace. */
    async loadSetup(workspaceId: string, withPay: boolean): Promise<Setup> {
        const [positions, staff, pay, blocks, settings] = await Promise.all([
            this.entityManager.query<Array<ShiftsPositionRow>>(SELECT_POSITIONS, [workspaceId]),
            this.entityManager.query<Array<ShiftsStaffRow>>(SELECT_STAFF, [workspaceId]),
            withPay
                ? this.entityManager.query<Array<ShiftsPayRow>>(SELECT_PAY, [workspaceId])
                : Promise.resolve<Array<ShiftsPayRow>>([]),
            this.entityManager.query<Array<ShiftsCoverageRow>>(SELECT_COVERAGE, [workspaceId]),
            this.entityManager.query<Array<ShiftsSettingsRow>>(SELECT_SETTINGS, [workspaceId]),
        ])
        const wages = new Map(pay.map((row) => [row.staff_id, Number(row.hourly_wage_vnd) || 0]))
        return {
            positions: positions.map(toPosition),
            staff: staff.map((row) => toStaff(row, wages.get(row.id) ?? 0)),
            blocks: blocks.map(toBlock),
            settings: toSettings(settings[0]),
        }
    }

    /** The environment the rules run in: approved availability and leave, and the work of the day before the week. */
    async loadEnv(workspaceId: string, monday: string, setup: Setup): Promise<Env> {
        const [availability, leaves, prior] = await Promise.all([
            this.entityManager.query<Array<ShiftsAvailabilityRow>>(SELECT_AVAILABILITY, [workspaceId]),
            this.entityManager.query<Array<ShiftsLeaveRow>>(SELECT_APPROVED_LEAVES, [
                workspaceId,
                monday,
                addDays(monday, 6),
            ]),
            this.entityManager.query<Array<ShiftsShiftRow>>(SELECT_PRIOR_SHIFTS, [workspaceId, addDays(monday, -1)]),
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
        const rows = await this.entityManager.query<Array<ShiftsShiftRow>>(SELECT_SCHEDULE_SHIFTS, [
            workspaceId,
            scheduleId,
        ])
        return rows.map(toShift)
    }

    /** One shift with the state of its schedule, or undefined. */
    shiftRow(workspaceId: string, shiftId: string): Promise<ShiftsShiftRow | undefined> {
        return this.first(this.entityManager.query<Array<ShiftsShiftRow>>(SELECT_SHIFT, [workspaceId, shiftId]))
    }

    /** One schedule, or undefined. */
    scheduleRow(workspaceId: string, scheduleId: string): Promise<ShiftsScheduleRow | undefined> {
        return this.first(
            this.entityManager.query<Array<ShiftsScheduleRow>>(SELECT_SCHEDULE, [workspaceId, scheduleId]),
        )
    }

    /** The shifts of everyone in a range of days that are in one of the statuses. */
    async rangeShifts(
        workspaceId: string,
        from: string,
        to: string,
        statuses: ReadonlyArray<string>,
    ): Promise<Array<Shift>> {
        const rows = await this.entityManager.query<Array<ShiftsShiftRow>>(SELECT_RANGE_SHIFTS, [
            workspaceId,
            from,
            to,
            statuses,
        ])
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
        const rows = await this.entityManager.query<Array<ShiftsShiftRow>>(SELECT_STAFF_SHIFTS, [
            workspaceId,
            staffId,
            from,
            to,
            statuses,
        ])
        return rows.map(toShift)
    }

    /** The profile of the member in the shifts of the workspace, or null when the member has none. */
    async profileOf(workspaceId: string, userId: string): Promise<string | null> {
        const [row] = await this.entityManager.query<Array<ShiftsIdRow>>(SELECT_PROFILE_OF_USER, [workspaceId, userId])
        return row?.id ?? null
    }

    /** One leave request, or undefined. */
    leaveRow(workspaceId: string, leaveId: string): Promise<ShiftsLeaveRow | undefined> {
        return this.first(this.entityManager.query<Array<ShiftsLeaveRow>>(SELECT_LEAVE, [workspaceId, leaveId]))
    }

    /** One swap or claim request, or undefined. */
    swapRow(workspaceId: string, swapId: string): Promise<ShiftsSwapRow | undefined> {
        return this.first(this.entityManager.query<Array<ShiftsSwapRow>>(SELECT_SWAP, [workspaceId, swapId]))
    }

    /** How many times an action was asked for one subject, so a repeated ask gets a fresh dedupe key. */
    async askAttempts(workspaceId: string, action: string, prefix: string): Promise<number> {
        const [row] = await this.entityManager.query<Array<{ attempts: number }>>(COUNT_WORK_ASKS, [
            workspaceId,
            action,
            `${prefix}%`,
        ])
        return row?.attempts ?? 0
    }
    private async first<Row>(rows: Promise<Array<Row>>): Promise<Row | undefined> {
        const [row] = await rows
        return row
    }
}
