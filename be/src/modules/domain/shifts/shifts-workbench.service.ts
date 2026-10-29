import { Injectable } from "@nestjs/common"
import { Between, In, IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkItemsService } from "@modules/domain/work-items"
import type { WorkItem } from "@modules/domain/work-items"
import { AutomationPipelinesService } from "@modules/domain/automation-pipelines"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ShiftsError, ShiftsErrorCode } from "./errors/shifts.error"
import type { Setup, Shift } from "./shifts.contracts"
import { ShiftsDataService } from "./shifts-data.service"
import type {
    ShiftsAvailabilityView,
    ShiftsBenchView,
    ShiftsFiguresView,
    ShiftsLeaveView,
    ShiftsMineView,
    ShiftsRequestsView,
    ShiftsScheduleView,
    ShiftsStaffRowView,
    ShiftsSwapView,
    ShiftsWeekView,
    ShiftsWorkItemView,
} from "./shifts-workbench.contracts"
import {
    ShiftsAttendanceEntity,
    ShiftsAvailabilityEntity,
    ShiftsLeaveRequestEntity,
    ShiftsScheduleEntity,
    ShiftsShiftEntity,
    ShiftsSwapRequestEntity,
} from "./persistence/entities"
import { profileIdOfMember } from "./persistence/shifts-profile.query"
import { isReminderOn } from "./persistence/shifts-pipeline.query"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { isDay } from "./policies/input-text.policy"
import { addDays, mondayOf, todayVn } from "./policies/time.policy"

/** Days ahead the member's own view lists shifts for. */
const MINE_DAYS = 14
/** Days ahead the open-gap figure counts. */
const GAP_DAYS = 14
/** The scheduled minutes of a month, the one aggregate the workbench reads raw. */
interface MinutesRead {
    /** The minutes. */
    readonly minutes: number | string
}

/** The most versions of one week one read answers. */
const VERSIONS_MAX = 20
/** The most leave and swap requests one read answers. */
const REQUESTS_MAX = 200
/** The most availability statements one read answers. */
const AVAILABILITY_MAX = 500
/** The most decision rows one read answers. */
const ITEMS_MAX = 200
/** The most check-ins one read answers. */
const ATTENDANCE_MAX = 2000
/** The most shifts of a range of days one read answers. */
const POSTED_MAX = 2000
/** The most shifts of the swap request lines one read answers. */
const SWAP_SHIFTS_MAX = 500
/** Matches no person; filters the requests of a member without a shifts profile. */
const UNLINKED_STAFF = "00000000-0000-0000-0000-000000000000"

const iso = (value: Date | string | null): string | null => {
    if (value === null) return null
    if (typeof value === "string") return value
    return value.toISOString()
}

/** The summary sentence of a proposal or result json, or null. */
const summaryOf = (value: unknown): string | null => {
    if (typeof value !== "object" || value === null || !("summary" in value)) return null
    const summary = value.summary
    return typeof summary === "string" ? summary : null
}

const recordOf = (value: unknown): Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : {}

const itemOf = (row: Pick<WorkItem, "id" | "status" | "proposal" | "result" | "decided_path">): ShiftsWorkItemView => ({
    id: row.id,
    status: row.status,
    summary: summaryOf(row.proposal) ?? "",
    resultSummary: summaryOf(row.result),
    decidedPath: row.decided_path,
})

const availView = (row: ShiftsAvailabilityEntity): ShiftsAvailabilityView => ({
    id: row.id,
    staffId: row.staffId,
    weekday: row.weekday,
    date: row.shiftDate,
    start: row.startTime.slice(0, 5),
    end: row.endTime.slice(0, 5),
    available: row.available,
    note: row.note,
    status: row.status,
    createdAt: iso(row.createdAt) ?? "",
})

const shiftOf = (row: ShiftsShiftEntity): Shift => ({
    id: row.id,
    date: row.shiftDate,
    start: row.startTime.slice(0, 5),
    end: row.endTime.slice(0, 5),
    positionId: row.positionId,
    staffId: row.staffId,
    status: row.status,
})

/** A month range. */
interface MonthBounds {
    /** The first day of the month. */
    readonly from: string
    /** The first day of the next month. */
    readonly to: string
}

const monthBounds = (today: string): MonthBounds => {
    const from = `${today.slice(0, 7)}-01`
    return { from, to: `${addDays(from, 31).slice(0, 7)}-01` }
}

const shiftLine = (shift: Shift | undefined, positions: Map<string, string>): string => {
    if (shift === undefined) return "—"
    return `${shift.date.slice(8, 10)}/${shift.date.slice(5, 7)} ${shift.start}–${shift.end} ${positions.get(shift.positionId) ?? ""}`.trim()
}

@Injectable()
/** The read model of the shifts workbench and of the member's own schedule page: what the week looks like, the requests, and the member's next shifts. */
export class ShiftsWorkbenchService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly data: ShiftsDataService,
        private readonly workItemsOf: WorkItemsService,
        private readonly staff: StaffDirectoryService,
        private readonly pipelines: AutomationPipelinesService,
    ) {}

    /** The whole workbench of one week: setup, versions, requests, figures for a manager. */
    async bench(userId: string, workspaceId: string, week?: string): Promise<ShiftsBenchView> {
        if (week !== undefined && !isDay(week)) throw new ShiftsError({ code: ShiftsErrorCode.WeekInvalid })
        const member = await this.members.require(userId, workspaceId)
        const isManager = MANAGER_ROLES.includes(member.role)
        const today = todayVn(this.clock.now())
        const monday = mondayOf(week ?? today)
        const [setup, myProfileId, reminderOn] = await Promise.all([
            this.data.loadSetup(workspaceId, isManager),
            this.profileOfMember(workspaceId, userId, member.staffId),
            isReminderOn(this.pipelines, workspaceId),
        ])
        const [weekView, requests, staffRows, allAvailability, figures] = await Promise.all([
            this.weekView(workspaceId, monday, setup, isManager),
            this.requestsView(workspaceId, setup.positions, isManager ? null : (myProfileId ?? UNLINKED_STAFF)),
            isManager ? this.shopStaff(workspaceId) : Promise.resolve<Array<ShiftsStaffRowView>>([]),
            isManager
                ? this.availability(workspaceId, null).then((rows) => rows.map(availView))
                : Promise.resolve<Array<ShiftsAvailabilityView>>([]),
            isManager ? this.figures(workspaceId, today) : Promise.resolve<null>(null),
        ])
        return {
            role: member.role,
            today,
            setup,
            myProfileId,
            reminderOn,
            week: weekView,
            requests,
            staffRows,
            allAvailability,
            figures,
        }
    }

    /** The member's own schedule: their next shifts, open shifts to take and their requests. */
    async mine(userId: string, workspaceId: string): Promise<ShiftsMineView> {
        const member = await this.members.require(userId, workspaceId)
        const today = todayVn(this.clock.now())
        const profileId = await this.profileOfMember(workspaceId, userId, member.staffId)
        if (profileId === null) {
            return {
                profileId: null,
                today,
                myShifts: [],
                openShifts: [],
                colleagues: [],
                availability: [],
                leaves: [],
                swaps: [],
            }
        }
        const setup = await this.data.loadSetup(workspaceId, false)
        const positions = new Map(setup.positions.map((position) => [position.id, position.name]))
        const [posted, requests] = await Promise.all([
            this.entityManager.find(ShiftsShiftEntity, {
                where: {
                    workspaceId,
                    shiftDate: Between(today, addDays(today, MINE_DAYS)),
                    status: In(["published", "swapped"]),
                },
                order: { shiftDate: "ASC", startTime: "ASC" },
                take: POSTED_MAX,
            }),
            this.requestsView(workspaceId, setup.positions, profileId, positions),
        ])
        const shifts = posted.map(shiftOf)
        const mineIds = shifts.filter((shift) => shift.staffId === profileId).map((shift) => shift.id)
        const attendance = mineIds.length ? await this.attendance(workspaceId, mineIds) : []
        const checked = new Set(attendance.map((row) => row.shiftId))
        return {
            profileId,
            today,
            myShifts: shifts
                .filter((shift) => shift.staffId === profileId)
                .map((shift) => ({ ...shift, checkedIn: checked.has(shift.id) })),
            openShifts: shifts.filter((shift) => shift.staffId === null),
            colleagues: setup.staff
                .filter((person) => person.active && person.id !== profileId)
                .map((person) => ({ id: person.id, name: person.name, positionIds: person.positionIds })),
            availability: requests.availability,
            leaves: requests.leaves,
            swaps: requests.swaps,
        }
    }

    private async weekView(
        workspaceId: string,
        monday: string,
        setup: Setup,
        isManager: boolean,
    ): Promise<ShiftsWeekView> {
        const [scheduleRows, env] = await Promise.all([
            this.weekSchedules(workspaceId, monday),
            this.data.loadEnv(workspaceId, monday, setup),
        ])
        const versions = scheduleRows.map((row) => ({
            id: row.id,
            version: row.version,
            status: row.status,
            costVnd: Number(row.costVnd) || 0,
            createdAt: iso(row.createdAt) ?? "",
            publishedAt: iso(row.publishedAt),
        }))
        const currentRow =
            scheduleRows.find((row) => row.status === "draft") ??
            scheduleRows.find((row) => row.status === "published") ??
            null
        const [shifts, items] = await Promise.all([
            currentRow === null
                ? Promise.resolve<Array<Shift>>([])
                : this.data.scheduleShifts(workspaceId, currentRow.id),
            this.workItems(currentRow?.workItemId ? [currentRow.workItemId] : []),
        ])
        const attendance =
            isManager && shifts.length
                ? await this.attendance(
                      workspaceId,
                      shifts.map((shift) => shift.id),
                  )
                : []
        const staffSees = currentRow?.status === "published"
        const current: ShiftsScheduleView | null =
            currentRow === null || (!isManager && !staffSees) ? null : this.scheduleView(currentRow, isManager)
        return {
            monday,
            versions,
            current,
            shifts: isManager || staffSees ? shifts : [],
            publishItem: currentRow?.workItemId ? (items.get(currentRow.workItemId) ?? null) : null,
            checkins: attendance.map((row) => ({ shiftId: row.shiftId, checkedInAt: iso(row.checkedInAt) ?? "" })),
            approvedAvail: env.avail,
            approvedLeaves: env.leaves,
            prior: [...(env.prior?.entries() ?? [])].map(([staffId, segs]) => ({ staffId, segs })),
        }
    }

    private scheduleView(row: ShiftsScheduleEntity, isManager: boolean): ShiftsScheduleView {
        return {
            id: row.id,
            weekStart: row.weekStart,
            version: row.version,
            status: row.status,
            source: row.source,
            costVnd: Number(row.costVnd) || 0,
            explanation: row.explanation,
            solverMs: row.solverMs,
            summary: isManager ? recordOf(row.summary) : {},
            evidence: isManager ? recordOf(row.evidence) : {},
            workItemId: row.workItemId,
            createdAt: iso(row.createdAt) ?? "",
            publishedAt: iso(row.publishedAt),
        }
    }

    private async requestsView(
        workspaceId: string,
        positions: ReadonlyArray<{ id: string; name: string }>,
        onlyStaff: string | null,
        posNames?: Map<string, string>,
    ): Promise<ShiftsRequestsView> {
        const pos = posNames ?? new Map(positions.map((position) => [position.id, position.name]))
        const [leaves, swaps, availability] = await Promise.all([
            this.entityManager.find(ShiftsLeaveRequestEntity, {
                where: onlyStaff === null ? { workspaceId } : { workspaceId, staffId: onlyStaff },
                order: { createdAt: "DESC" },
                take: REQUESTS_MAX,
            }),
            this.entityManager.find(ShiftsSwapRequestEntity, {
                where:
                    onlyStaff === null
                        ? { workspaceId }
                        : [
                              { workspaceId, fromStaffId: onlyStaff },
                              { workspaceId, toStaffId: onlyStaff },
                          ],
                order: { createdAt: "DESC" },
                take: REQUESTS_MAX,
            }),
            this.availability(workspaceId, onlyStaff),
        ])
        const itemIds = [...leaves.map((row) => row.workItemId), ...swaps.map((row) => row.workItemId)].filter(
            (id): id is string => id !== null,
        )
        const [items, shiftRows] = await Promise.all([
            this.workItems(itemIds),
            swaps.length
                ? this.entityManager.find(ShiftsShiftEntity, {
                      where: { workspaceId, id: In([...new Set(swaps.map((row) => row.shiftId))]) },
                      take: SWAP_SHIFTS_MAX,
                  })
                : Promise.resolve<Array<ShiftsShiftEntity>>([]),
        ])
        const swapShifts = new Map(shiftRows.map((row) => [row.id, shiftOf(row)]))
        return {
            leaves: leaves.map((row) => this.leaveView(row, items)),
            swaps: swaps.map((row) => this.swapView(row, items, swapShifts, pos)),
            availability: availability.map(availView),
        }
    }

    private leaveView(row: ShiftsLeaveRequestEntity, items: Map<string, ShiftsWorkItemView>): ShiftsLeaveView {
        return {
            id: row.id,
            staffId: row.staffId,
            from: row.fromDate,
            to: row.toDate,
            reason: row.reason,
            status: row.status,
            workItemId: row.workItemId,
            createdAt: iso(row.createdAt) ?? "",
            item: row.workItemId ? (items.get(row.workItemId) ?? null) : null,
        }
    }

    private swapView(
        row: ShiftsSwapRequestEntity,
        items: Map<string, ShiftsWorkItemView>,
        swapShifts: Map<string, Shift>,
        positions: Map<string, string>,
    ): ShiftsSwapView {
        return {
            id: row.id,
            kind: row.kind,
            shiftId: row.shiftId,
            fromStaffId: row.fromStaffId,
            toStaffId: row.toStaffId,
            reason: row.reason,
            status: row.status,
            checks: Array.isArray(row.checks)
                ? row.checks.filter((check): check is string => typeof check === "string")
                : [],
            workItemId: row.workItemId,
            createdAt: iso(row.createdAt) ?? "",
            item: row.workItemId ? (items.get(row.workItemId) ?? null) : null,
            shiftLine: shiftLine(swapShifts.get(row.shiftId), positions),
        }
    }

    private async workItems(ids: ReadonlyArray<string>): Promise<Map<string, ShiftsWorkItemView>> {
        if (!ids.length) return new Map()
        const rows = await this.workItemsOf.findMany([...new Set(ids)], ITEMS_MAX)
        return new Map(rows.map((row) => [row.id, itemOf(row)]))
    }

    private weekSchedules(workspaceId: string, monday: string): Promise<Array<ShiftsScheduleEntity>> {
        return this.entityManager.find(ShiftsScheduleEntity, {
            select: {
                id: true,
                weekStart: true,
                version: true,
                status: true,
                source: true,
                costVnd: true,
                explanation: true,
                solverMs: true,
                summary: true,
                evidence: true,
                workItemId: true,
                createdAt: true,
                publishedAt: true,
            },
            where: { workspaceId, weekStart: monday },
            order: { version: "DESC" },
            take: VERSIONS_MAX,
        })
    }

    private availability(workspaceId: string, onlyStaff: string | null): Promise<Array<ShiftsAvailabilityEntity>> {
        return this.entityManager.find(ShiftsAvailabilityEntity, {
            where: onlyStaff === null ? { workspaceId } : { workspaceId, staffId: onlyStaff },
            order: { createdAt: "DESC" },
            take: AVAILABILITY_MAX,
        })
    }

    private attendance(workspaceId: string, shiftIds: ReadonlyArray<string>): Promise<Array<ShiftsAttendanceEntity>> {
        return this.entityManager.find(ShiftsAttendanceEntity, {
            select: { shiftId: true, checkedInAt: true },
            where: { workspaceId, shiftId: In([...shiftIds]) },
            take: ATTENDANCE_MAX,
        })
    }

    private async shopStaff(workspaceId: string): Promise<Array<ShiftsStaffRowView>> {
        const rows = await this.staff.list(workspaceId)
        return rows.map((row) => ({ id: row.id, name: row.name }))
    }

    private async figures(workspaceId: string, today: string): Promise<ShiftsFiguresView> {
        const month = monthBounds(today)
        const [scheduleRows, gaps, leaves, minutes] = await Promise.all([
            this.weekSchedules(workspaceId, mondayOf(today)),
            this.entityManager.count(ShiftsShiftEntity, {
                where: {
                    workspaceId,
                    status: "published",
                    staffId: IsNull(),
                    shiftDate: Between(today, addDays(today, GAP_DAYS)),
                },
            }),
            this.entityManager.count(ShiftsLeaveRequestEntity, { where: { workspaceId, status: "pending" } }),
            this.entityManager
                .createQueryBuilder(ShiftsShiftEntity, "s")
                .select("coalesce(sum(extract(epoch from (s.end_time - s.start_time)) / 60), 0)::int", "minutes")
                .where(
                    "s.workspace_id = :workspaceId AND s.status IN ('published', 'swapped') AND s.staff_id IS NOT NULL " +
                        "AND s.shift_date >= :from AND s.shift_date < :to",
                    { workspaceId, from: month.from, to: month.to },
                )
                .getRawOne<MinutesRead>(),
        ])
        const current =
            scheduleRows.find((row) => row.status === "draft") ?? scheduleRows.find((row) => row.status === "published")
        const shifts = current === undefined ? [] : await this.data.scheduleShifts(workspaceId, current.id)
        return {
            weekFilled: shifts.filter((shift) => shift.staffId !== null).length,
            weekTotal: shifts.length,
            weekHasSchedule: current !== undefined,
            openGaps: gaps,
            leavePending: leaves,
            hoursMonth: Math.round(Number(minutes?.minutes ?? 0) / 6) / 10,
        }
    }

    private profileOfMember(workspaceId: string, userId: string, staffRowId: string | null): Promise<string | null> {
        return profileIdOfMember(this.entityManager, workspaceId, userId, staffRowId)
    }
}
