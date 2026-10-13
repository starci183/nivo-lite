import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ShiftsError, ShiftsErrorCode } from "./errors/shifts.error"
import type {
    CheckInOutput,
    CheckInParams,
    DecideAvailabilityParams,
    RemoveAvailabilityParams,
    RemoveCoverageParams,
    RemovePositionParams,
    SaveShiftsAvailabilityOutput,
    SaveShiftsAvailabilityParams,
    SaveCoverageParams,
    SavePositionOutput,
    SavePositionParams,
    SaveShiftsSettingsParams,
    SaveStaffOutput,
    SaveStaffParams,
} from "./shifts-setup.contracts"
import { ShiftsDataService } from "./shifts-data.service"
import {
    CHECK_IN,
    DECIDE_AVAILABILITY,
    INSERT_AVAILABILITY,
    REMOVE_AVAILABILITY,
    REMOVE_COVERAGE,
    REMOVE_POSITION,
    SAVE_COVERAGE,
    SAVE_POSITION,
    SAVE_STAFF_PROFILE,
    SELECT_PROFILE_OF_MEMBER,
    UPSERT_PAY,
    UPSERT_SETTINGS,
} from "./persistence/shifts-workbench.sql"
import type { ShiftsIdRow } from "./persistence/shifts.rows"
import { ANY_MEMBER, MANAGER_ROLES } from "./policies/access-roles.policy"
import { isDay, isTime } from "./policies/input-text.policy"
import { instantOf, toMin } from "./policies/time.policy"

/** The default colour of a position, the one the grid uses. */
const DEFAULT_COLOR = "#2f6fed"
/** How many minutes before a shift a person may check in. */
const CHECKIN_EARLY_MIN = 30

const nameOf = (name: string, max: number): string => {
    const trimmed = name.trim()
    if (trimmed === "" || trimmed.length > max) throw new ShiftsError({ code: ShiftsErrorCode.SetupFieldInvalid })
    return trimmed
}

const windowOf = (start: string, end: string): void => {
    if (!isTime(start) || !isTime(end) || toMin(end) <= toMin(start)) {
        throw new ShiftsError({ code: ShiftsErrorCode.TimeInvalid })
    }
}

@Injectable()
/** The writes of the shifts setup tab and the member's own small acts: positions, people and pay, coverage, rules, availability and check-in. */
export class ShiftsSetupService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly data: ShiftsDataService,
    ) {}

    /** Creates or renames a position. */
    async savePosition(userId: string, workspaceId: string, request: SavePositionParams): Promise<SavePositionOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const name = nameOf(request.name, 60)
        const color = request.color?.trim() || DEFAULT_COLOR
        const [row] = await this.entityManager.query<Array<ShiftsIdRow>>(SAVE_POSITION, [
            workspaceId,
            request.id ?? null,
            name,
            color,
        ])
        if (row?.id === null || row?.id === undefined) throw new ShiftsError({ code: ShiftsErrorCode.StaffNotFound })
        return { id: row.id }
    }

    /** Retires a position; its coverage rows stay but stop matching. */
    async removePosition(userId: string, workspaceId: string, request: RemovePositionParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        await this.entityManager.query(REMOVE_POSITION, [workspaceId, request.id])
    }

    /** Creates or updates one person's shifts profile, with the wage when given. */
    async saveStaff(userId: string, workspaceId: string, request: SaveStaffParams): Promise<SaveStaffOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const name = nameOf(request.name, 80)
        const row = JSON.stringify({
            name,
            staffRowId: request.staffRowId ?? "",
            phone: request.phone?.trim() ?? "",
            telegramChatId: request.telegramChatId?.trim() ?? "",
            zaloUserId: request.zaloUserId?.trim() ?? "",
            positionIds: request.positionIds,
            maxWeek: request.maxWeek ?? "",
            maxDay: request.maxDay ?? "",
            minRest: request.minRest ?? "",
            active: request.active ?? true,
        })
        const [saved] = await this.entityManager.query<Array<ShiftsIdRow>>(SAVE_STAFF_PROFILE, [
            workspaceId,
            request.id ?? null,
            row,
        ])
        if (saved?.id === null || saved?.id === undefined)
            throw new ShiftsError({ code: ShiftsErrorCode.StaffNotFound })
        if (request.wage !== undefined) {
            await this.entityManager.query(UPSERT_PAY, [workspaceId, saved.id, Math.max(0, Math.round(request.wage))])
        }
        return { id: saved.id }
    }

    /** Updates one coverage block, or inserts one per weekday given. */
    async saveCoverage(userId: string, workspaceId: string, request: SaveCoverageParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        windowOf(request.start, request.end)
        const weekdays = request.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        if (weekdays.length === 0 || request.ideal < request.min) {
            throw new ShiftsError({ code: ShiftsErrorCode.SetupFieldInvalid })
        }
        await this.entityManager.query(SAVE_COVERAGE, [
            workspaceId,
            request.id ?? null,
            weekdays,
            request.start,
            request.end,
            request.positionId,
            request.min,
            request.ideal,
            request.peak,
        ])
    }

    /** Removes a coverage block. */
    async removeCoverage(userId: string, workspaceId: string, request: RemoveCoverageParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        await this.entityManager.query(REMOVE_COVERAGE, [workspaceId, request.id])
    }

    /** Saves the rules and the opening hours of the shop. */
    async saveSettings(userId: string, workspaceId: string, request: SaveShiftsSettingsParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const opening: Record<string, { open: string; close: string } | null> = {}
        for (const day of request.openingHours) {
            if (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6) {
                throw new ShiftsError({ code: ShiftsErrorCode.SetupFieldInvalid })
            }
            if (day.open === "" || day.close === "") {
                opening[String(day.weekday)] = null
                continue
            }
            if (!isTime(day.open) || !isTime(day.close) || toMin(day.close) <= toMin(day.open)) {
                throw new ShiftsError({ code: ShiftsErrorCode.SetupFieldInvalid })
            }
            opening[String(day.weekday)] = { open: day.open, close: day.close }
        }
        await this.entityManager.query(UPSERT_SETTINGS, [
            workspaceId,
            JSON.stringify(opening),
            request.swapNoticeHours,
            request.leaveNoticeDays,
            request.remindMinutes,
            request.noshowMinutes,
            request.overtimeHoursWeek,
        ])
    }

    /** A manager enters an availability statement for a person; it is approved at once. */
    async addAvailability(
        userId: string,
        workspaceId: string,
        request: SaveShiftsAvailabilityParams,
    ): Promise<SaveShiftsAvailabilityOutput> {
        const { displayName } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        if (request.staffId === undefined) throw new ShiftsError({ code: ShiftsErrorCode.StaffNotFound })
        return this.insertAvailability(workspaceId, request.staffId, request, "approved", displayName)
    }

    /** A member files their own availability statement; it waits for the manager. */
    async submitAvailability(
        userId: string,
        workspaceId: string,
        request: SaveShiftsAvailabilityParams,
    ): Promise<SaveShiftsAvailabilityOutput> {
        await this.members.require(userId, workspaceId, ANY_MEMBER)
        const own = await this.profileOfMember(workspaceId, userId)
        return this.insertAvailability(workspaceId, own, request, "pending", null)
    }

    /** Removes an availability statement. */
    async removeAvailability(userId: string, workspaceId: string, request: RemoveAvailabilityParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        await this.entityManager.query(REMOVE_AVAILABILITY, [workspaceId, request.id])
    }

    /** Approves or declines a pending availability statement. */
    async decideAvailability(userId: string, workspaceId: string, request: DecideAvailabilityParams): Promise<void> {
        const { displayName } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        await this.entityManager.query(DECIDE_AVAILABILITY, [
            workspaceId,
            request.id,
            request.approve ? "approved" : "declined",
            displayName,
        ])
    }

    /** A person checks in to their own shift, from thirty minutes before the start until it ends. */
    async checkIn(userId: string, workspaceId: string, request: CheckInParams): Promise<CheckInOutput> {
        await this.members.require(userId, workspaceId, ANY_MEMBER)
        const own = await this.profileOfMember(workspaceId, userId)
        const shift = await this.data.shiftRow(workspaceId, request.shiftId)
        if (shift === undefined) throw new ShiftsError({ code: ShiftsErrorCode.ShiftNotFound })
        if (shift.staff_id !== own) throw new ShiftsError({ code: ShiftsErrorCode.CheckinNotYours })
        const now = this.clock.now()
        const start = instantOf(shift.shift_date, toMin(shift.start_time)).getTime()
        const end = instantOf(shift.shift_date, toMin(shift.end_time)).getTime()
        if (now.getTime() < start - CHECKIN_EARLY_MIN * 60_000) {
            throw new ShiftsError({ code: ShiftsErrorCode.CheckinEarly })
        }
        if (now.getTime() > end) throw new ShiftsError({ code: ShiftsErrorCode.CheckinClosed })
        const [row] = await this.entityManager.query<Array<{ checked_in_at: Date | string | null }>>(CHECK_IN, [
            workspaceId,
            request.shiftId,
            own,
        ])
        const at = row?.checked_in_at
        return { at: typeof at === "string" ? at : (at ?? now).toISOString() }
    }

    private async insertAvailability(
        workspaceId: string,
        staffId: string,
        request: SaveShiftsAvailabilityParams,
        status: "approved" | "pending",
        decider: string | null,
    ): Promise<SaveShiftsAvailabilityOutput> {
        const day = request.date ?? null
        const weekday = day === null ? request.weekday : null
        if ((day === null) === (weekday === null || weekday === undefined)) {
            throw new ShiftsError({ code: ShiftsErrorCode.AvailabilityInvalid })
        }
        if (day !== null && !isDay(day)) throw new ShiftsError({ code: ShiftsErrorCode.AvailabilityInvalid })
        if (weekday !== null && weekday !== undefined && (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)) {
            throw new ShiftsError({ code: ShiftsErrorCode.AvailabilityInvalid })
        }
        windowOf(request.start, request.end)
        const [row] = await this.entityManager.query<Array<ShiftsIdRow>>(INSERT_AVAILABILITY, [
            workspaceId,
            staffId,
            weekday ?? null,
            day,
            request.start,
            request.end,
            request.available,
            (request.note ?? "").trim().slice(0, 200),
            status,
            decider,
        ])
        return { id: row?.id ?? "" }
    }

    private async profileOfMember(workspaceId: string, userId: string): Promise<string> {
        const member = await this.members.require(userId, workspaceId)
        const [row] = await this.entityManager.query<Array<ShiftsIdRow>>(SELECT_PROFILE_OF_MEMBER, [
            workspaceId,
            userId,
            member.staffId,
        ])
        if (row?.id === null || row?.id === undefined) throw new ShiftsError({ code: ShiftsErrorCode.ProfileMissing })
        return row.id
    }
}
