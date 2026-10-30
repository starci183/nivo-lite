import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
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
    ShiftsAttendanceEntity,
    ShiftsAvailabilityEntity,
    ShiftsCoverageEntity,
    ShiftsPositionEntity,
    ShiftsSettingsEntity,
    ShiftsStaffEntity,
    ShiftsStaffPayEntity,
} from "./persistence/entities"
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

/** The id a `RETURNING id` answered, or undefined when no row matched. */
const idOf = (raw: unknown): string | undefined => {
    const id = [raw].flat().find(isRecord)?.id
    return typeof id === "string" ? id : undefined
}

/** True for the time a check-in was stored: a timestamp or its ISO text. */
const isStamp = (value: unknown): value is Date | string => typeof value === "string" || value instanceof Date

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
        const saved =
            request.id === undefined
                ? await this.entityManager
                      .createQueryBuilder(ShiftsPositionEntity, "s")
                      .insert()
                      .values({ workspaceId, name, color })
                      .orUpdate(["color"], ["workspace_id", "name"])
                      .returning("id")
                      .execute()
                : await this.entityManager
                      .createQueryBuilder(ShiftsPositionEntity, "s")
                      .update()
                      .set({ name, color })
                      .where("workspace_id = :workspaceId AND id = :id", { workspaceId, id: request.id })
                      .returning("id")
                      .execute()
        const id = idOf(saved.raw)
        if (id === undefined) throw new ShiftsError({ code: ShiftsErrorCode.StaffNotFound })
        return { id }
    }

    /** Retires a position; its coverage rows stay but stop matching. */
    async removePosition(userId: string, workspaceId: string, request: RemovePositionParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        await this.entityManager.update(ShiftsPositionEntity, { workspaceId, id: request.id }, { active: false })
    }

    /** Creates or updates one person's shifts profile, with the wage when given. */
    async saveStaff(userId: string, workspaceId: string, request: SaveStaffParams): Promise<SaveStaffOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const name = nameOf(request.name, 80)
        const fields = {
            name,
            staffId: request.staffRowId || null,
            phone: request.phone?.trim() || null,
            telegramChatId: request.telegramChatId?.trim() || null,
            zaloUserId: request.zaloUserId?.trim() || null,
            positionIds: [...request.positionIds],
            ...(request.maxWeek === undefined ? {} : { maxHoursWeek: String(request.maxWeek) }),
            ...(request.maxDay === undefined ? {} : { maxHoursDay: String(request.maxDay) }),
            ...(request.minRest === undefined ? {} : { minRestHours: String(request.minRest) }),
            active: request.active ?? true,
        }
        const result =
            request.id === undefined
                ? await this.entityManager
                      .createQueryBuilder(ShiftsStaffEntity, "s")
                      .insert()
                      .values({ workspaceId, ...fields })
                      .returning("id")
                      .execute()
                : await this.entityManager
                      .createQueryBuilder(ShiftsStaffEntity, "s")
                      .update()
                      .set(fields)
                      .where("workspace_id = :workspaceId AND id = :id", { workspaceId, id: request.id })
                      .returning("id")
                      .execute()
        const saved = idOf(result.raw)
        if (saved === undefined) throw new ShiftsError({ code: ShiftsErrorCode.StaffNotFound })
        if (request.wage !== undefined) {
            await this.entityManager.upsert(
                ShiftsStaffPayEntity,
                {
                    staffId: saved,
                    workspaceId,
                    hourlyWageVnd: Math.max(0, Math.round(request.wage)),
                },
                ["staffId"],
            )
        }
        return { id: saved }
    }

    /** Updates one coverage block, or inserts one per weekday given. */
    async saveCoverage(userId: string, workspaceId: string, request: SaveCoverageParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        windowOf(request.start, request.end)
        const weekdays = request.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        const [first] = weekdays
        if (first === undefined || request.ideal < request.min) {
            throw new ShiftsError({ code: ShiftsErrorCode.SetupFieldInvalid })
        }
        const block = {
            startTime: request.start,
            endTime: request.end,
            positionId: request.positionId,
            minStaff: request.min,
            idealStaff: request.ideal,
            isPeak: request.peak,
        }
        if (request.id === undefined) {
            await this.entityManager.insert(
                ShiftsCoverageEntity,
                weekdays.map((weekday) => ({ workspaceId, weekday, ...block })),
            )
            return
        }
        await this.entityManager.update(
            ShiftsCoverageEntity,
            { workspaceId, id: request.id },
            { weekday: first, ...block },
        )
    }

    /** Removes a coverage block. */
    async removeCoverage(userId: string, workspaceId: string, request: RemoveCoverageParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        await this.entityManager.delete(ShiftsCoverageEntity, { workspaceId, id: request.id })
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
        await this.entityManager.upsert(
            ShiftsSettingsEntity,
            {
                workspaceId,
                openingHours: opening,
                swapNoticeHours: request.swapNoticeHours,
                leaveNoticeDays: request.leaveNoticeDays,
                remindMinutes: request.remindMinutes,
                noshowMinutes: request.noshowMinutes,
                overtimeHoursWeek: String(request.overtimeHoursWeek),
            },
            ["workspaceId"],
        )
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
        await this.entityManager.delete(ShiftsAvailabilityEntity, { workspaceId, id: request.id })
    }

    /** Approves or declines a pending availability statement. */
    async decideAvailability(userId: string, workspaceId: string, request: DecideAvailabilityParams): Promise<void> {
        const { displayName } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        await this.entityManager.update(
            ShiftsAvailabilityEntity,
            { workspaceId, id: request.id, status: "pending" },
            { status: request.approve ? "approved" : "declined", decidedBy: displayName },
        )
    }

    /** A person checks in to their own shift, from thirty minutes before the start until it ends. */
    async checkIn(userId: string, workspaceId: string, request: CheckInParams): Promise<CheckInOutput> {
        await this.members.require(userId, workspaceId, ANY_MEMBER)
        const own = await this.profileOfMember(workspaceId, userId)
        const shift = await this.data.shiftRow(workspaceId, request.shiftId)
        if (shift === undefined) throw new ShiftsError({ code: ShiftsErrorCode.ShiftNotFound })
        if (shift.staffId !== own) throw new ShiftsError({ code: ShiftsErrorCode.CheckinNotYours })
        const now = this.clock.now()
        const start = instantOf(shift.shiftDate, toMin(shift.startTime)).getTime()
        const end = instantOf(shift.shiftDate, toMin(shift.endTime)).getTime()
        if (now.getTime() < start - CHECKIN_EARLY_MIN * 60_000) {
            throw new ShiftsError({ code: ShiftsErrorCode.CheckinEarly })
        }
        if (now.getTime() > end) throw new ShiftsError({ code: ShiftsErrorCode.CheckinClosed })
        const inserted = await this.entityManager
            .createQueryBuilder(ShiftsAttendanceEntity, "s")
            .insert()
            .values({ workspaceId, shiftId: request.shiftId, staffId: own })
            .orIgnore()
            .returning("checked_in_at")
            .execute()
        const checkedInAt = [inserted.raw].flat().find(isRecord)?.checked_in_at
        const stored =
            (isStamp(checkedInAt) ? checkedInAt : undefined) ??
            (
                await this.entityManager.findOne(ShiftsAttendanceEntity, {
                    where: { shiftId: request.shiftId, staffId: own },
                })
            )?.checkedInAt
        return { at: typeof stored === "string" ? stored : (stored ?? now).toISOString() }
    }

    private async insertAvailability(
        workspaceId: string,
        staffId: string,
        request: SaveShiftsAvailabilityParams,
        status: "approved" | "pending",
        decider: string | null,
    ): Promise<SaveShiftsAvailabilityOutput> {
        const day = request.date ?? null
        const weekday = request.weekday
        if ((day === null) === (weekday === null)) {
            throw new ShiftsError({ code: ShiftsErrorCode.AvailabilityInvalid })
        }
        if (day !== null && !isDay(day)) throw new ShiftsError({ code: ShiftsErrorCode.AvailabilityInvalid })
        if (weekday !== null && (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)) {
            throw new ShiftsError({ code: ShiftsErrorCode.AvailabilityInvalid })
        }
        windowOf(request.start, request.end)
        const result = await this.entityManager.insert(ShiftsAvailabilityEntity, {
            workspaceId,
            staffId,
            weekday: weekday ?? null,
            shiftDate: day,
            startTime: request.start,
            endTime: request.end,
            available: request.available,
            note: (request.note ?? "").trim().slice(0, 200),
            status,
            decidedBy: decider,
        })
        const id: unknown = result.identifiers[0]?.id
        return { id: typeof id === "string" ? id : "" }
    }

    private async profileOfMember(workspaceId: string, userId: string): Promise<string> {
        const member = await this.members.require(userId, workspaceId)
        const id = await this.data.profileIdOfMember(workspaceId, userId, member.staffId)
        if (id === null) throw new ShiftsError({ code: ShiftsErrorCode.ProfileMissing })
        return id
    }
}
