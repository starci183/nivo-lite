import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
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
    COUNT_OPEN_GAPS,
    COUNT_PENDING_LEAVES,
    SELECT_ALL_AVAILABILITY,
    SELECT_ATTENDANCE,
    SELECT_LEAVES,
    SELECT_POSTED_SHIFTS,
    SELECT_PROFILE_OF_MEMBER,
    SELECT_REMINDER_ON,
    SELECT_SHIFTS_BY_IDS,
    SELECT_SHOP_STAFF,
    SELECT_SWAPS,
    SELECT_WEEK_SCHEDULES,
    SELECT_WORK_ITEMS,
    SUM_MONTH_MINUTES,
} from "./persistence/shifts-workbench.sql"
import type {
    CountRow,
    EnabledRow,
    MinutesRow,
    WorkbenchAttendanceRow,
    WorkbenchAvailabilityRow,
    WorkbenchItemRow,
    WorkbenchLeaveRow,
    WorkbenchScheduleRow,
    WorkbenchShiftRow,
    WorkbenchStaffRow,
    WorkbenchSwapRow,
} from "./persistence/shifts-workbench.rows"
import type { ShiftsIdRow } from "./persistence/shifts.rows"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { isDay } from "./policies/input-text.policy"
import { addDays, mondayOf, todayVn } from "./policies/time.policy"

/** Days ahead the member's own view lists shifts for. */
const MINE_DAYS = 14
/** Days ahead the open-gap figure counts. */
const GAP_DAYS = 14
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

const itemOf = (row: WorkbenchItemRow): ShiftsWorkItemView => ({
    id: row.id,
    status: row.status,
    summary: summaryOf(row.proposal) ?? "",
    resultSummary: summaryOf(row.result),
    decidedPath: row.decided_path,
})

const availView = (row: WorkbenchAvailabilityRow): ShiftsAvailabilityView => ({
    id: row.id,
    staffId: row.staff_id,
    weekday: row.weekday,
    date: row.shift_date,
    start: row.start_time.slice(0, 5),
    end: row.end_time.slice(0, 5),
    available: row.available,
    note: row.note,
    status: row.status,
    createdAt: iso(row.created_at) ?? "",
})

const shiftOf = (row: WorkbenchShiftRow): Shift => ({
    id: row.id,
    date: row.shift_date,
    start: row.start_time.slice(0, 5),
    end: row.end_time.slice(0, 5),
    positionId: row.position_id,
    staffId: row.staff_id,
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
            this.reminderOn(workspaceId),
        ])
        const [weekView, requests, staffRows, allAvailability, figures] = await Promise.all([
            this.weekView(workspaceId, monday, setup, isManager),
            this.requestsView(workspaceId, setup.positions, isManager ? null : (myProfileId ?? UNLINKED_STAFF)),
            isManager ? this.shopStaff(workspaceId) : Promise.resolve<Array<ShiftsStaffRowView>>([]),
            isManager
                ? this.entityManager
                      .query<Array<WorkbenchAvailabilityRow>>(SELECT_ALL_AVAILABILITY, [workspaceId, null])
                      .then((rows) => rows.map(availView))
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
            this.entityManager.query<Array<WorkbenchShiftRow>>(SELECT_POSTED_SHIFTS, [
                workspaceId,
                today,
                addDays(today, MINE_DAYS),
            ]),
            this.requestsView(workspaceId, setup.positions, profileId, positions),
        ])
        const shifts = posted.map(shiftOf)
        const mineIds = shifts.filter((shift) => shift.staffId === profileId).map((shift) => shift.id)
        const attendance = mineIds.length
            ? await this.entityManager.query<Array<WorkbenchAttendanceRow>>(SELECT_ATTENDANCE, [workspaceId, mineIds])
            : []
        const checked = new Set(attendance.map((row) => row.shift_id))
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
            this.entityManager.query<Array<WorkbenchScheduleRow>>(SELECT_WEEK_SCHEDULES, [workspaceId, monday]),
            this.data.loadEnv(workspaceId, monday, setup),
        ])
        const versions = scheduleRows.map((row) => ({
            id: row.id,
            version: row.version,
            status: row.status,
            costVnd: Number(row.cost_vnd) || 0,
            createdAt: iso(row.created_at) ?? "",
            publishedAt: iso(row.published_at),
        }))
        const currentRow =
            scheduleRows.find((row) => row.status === "draft") ??
            scheduleRows.find((row) => row.status === "published") ??
            null
        const [shifts, items] = await Promise.all([
            currentRow === null
                ? Promise.resolve<Array<Shift>>([])
                : this.data.scheduleShifts(workspaceId, currentRow.id),
            this.workItems(currentRow?.work_item_id ? [currentRow.work_item_id] : []),
        ])
        const attendance =
            isManager && shifts.length
                ? await this.entityManager.query<Array<WorkbenchAttendanceRow>>(SELECT_ATTENDANCE, [
                      workspaceId,
                      shifts.map((shift) => shift.id),
                  ])
                : []
        const staffSees = currentRow?.status === "published"
        const current: ShiftsScheduleView | null =
            currentRow === null || (!isManager && !staffSees) ? null : this.scheduleView(currentRow, isManager)
        return {
            monday,
            versions,
            current,
            shifts: isManager || staffSees ? shifts : [],
            publishItem: currentRow?.work_item_id ? (items.get(currentRow.work_item_id) ?? null) : null,
            checkins: attendance.map((row) => ({ shiftId: row.shift_id, checkedInAt: iso(row.checked_in_at) ?? "" })),
            approvedAvail: env.avail,
            approvedLeaves: env.leaves,
            prior: [...(env.prior ?? new Map()).entries()].map(([staffId, segs]) => ({ staffId, segs })),
        }
    }

    private scheduleView(row: WorkbenchScheduleRow, isManager: boolean): ShiftsScheduleView {
        return {
            id: row.id,
            weekStart: row.week_start,
            version: row.version,
            status: row.status,
            source: row.source,
            costVnd: Number(row.cost_vnd) || 0,
            explanation: row.explanation,
            solverMs: row.solver_ms,
            summary: isManager ? (row.summary ?? {}) : {},
            evidence: isManager ? (row.evidence ?? {}) : {},
            workItemId: row.work_item_id,
            createdAt: iso(row.created_at) ?? "",
            publishedAt: iso(row.published_at),
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
            this.entityManager.query<Array<WorkbenchLeaveRow>>(SELECT_LEAVES, [workspaceId, onlyStaff]),
            this.entityManager.query<Array<WorkbenchSwapRow>>(SELECT_SWAPS, [workspaceId, onlyStaff]),
            this.entityManager.query<Array<WorkbenchAvailabilityRow>>(SELECT_ALL_AVAILABILITY, [
                workspaceId,
                onlyStaff,
            ]),
        ])
        const itemIds = [...leaves.map((row) => row.work_item_id), ...swaps.map((row) => row.work_item_id)].filter(
            (id): id is string => id !== null,
        )
        const [items, shiftRows] = await Promise.all([
            this.workItems(itemIds),
            swaps.length
                ? this.entityManager.query<Array<WorkbenchShiftRow>>(SELECT_SHIFTS_BY_IDS, [
                      workspaceId,
                      [...new Set(swaps.map((row) => row.shift_id))],
                  ])
                : Promise.resolve<Array<WorkbenchShiftRow>>([]),
        ])
        const swapShifts = new Map(shiftRows.map((row) => [row.id, shiftOf(row)]))
        return {
            leaves: leaves.map((row) => this.leaveView(row, items)),
            swaps: swaps.map((row) => this.swapView(row, items, swapShifts, pos)),
            availability: availability.map(availView),
        }
    }

    private leaveView(row: WorkbenchLeaveRow, items: Map<string, ShiftsWorkItemView>): ShiftsLeaveView {
        return {
            id: row.id,
            staffId: row.staff_id,
            from: row.from_date,
            to: row.to_date,
            reason: row.reason,
            status: row.status,
            workItemId: row.work_item_id,
            createdAt: iso(row.created_at) ?? "",
            item: row.work_item_id ? (items.get(row.work_item_id) ?? null) : null,
        }
    }

    private swapView(
        row: WorkbenchSwapRow,
        items: Map<string, ShiftsWorkItemView>,
        swapShifts: Map<string, Shift>,
        positions: Map<string, string>,
    ): ShiftsSwapView {
        return {
            id: row.id,
            kind: row.kind,
            shiftId: row.shift_id,
            fromStaffId: row.from_staff_id,
            toStaffId: row.to_staff_id,
            reason: row.reason,
            status: row.status,
            checks: row.checks ?? [],
            workItemId: row.work_item_id,
            createdAt: iso(row.created_at) ?? "",
            item: row.work_item_id ? (items.get(row.work_item_id) ?? null) : null,
            shiftLine: shiftLine(swapShifts.get(row.shift_id), positions),
        }
    }

    private async workItems(ids: ReadonlyArray<string>): Promise<Map<string, ShiftsWorkItemView>> {
        if (!ids.length) return new Map()
        const rows = await this.entityManager.query<Array<WorkbenchItemRow>>(SELECT_WORK_ITEMS, [[...new Set(ids)]])
        return new Map(rows.map((row) => [row.id, itemOf(row)]))
    }

    private shopStaff(workspaceId: string): Promise<Array<ShiftsStaffRowView>> {
        return this.entityManager.query<Array<WorkbenchStaffRow>>(SELECT_SHOP_STAFF, [workspaceId])
    }

    private async reminderOn(workspaceId: string): Promise<boolean> {
        const [row] = await this.entityManager.query<Array<EnabledRow>>(SELECT_REMINDER_ON, [workspaceId])
        return row?.enabled === true
    }

    private async figures(workspaceId: string, today: string): Promise<ShiftsFiguresView> {
        const month = monthBounds(today)
        const [scheduleRows, gaps, leaves, minutes] = await Promise.all([
            this.entityManager.query<Array<WorkbenchScheduleRow>>(SELECT_WEEK_SCHEDULES, [
                workspaceId,
                mondayOf(today),
            ]),
            this.entityManager.query<Array<CountRow>>(COUNT_OPEN_GAPS, [workspaceId, today, addDays(today, GAP_DAYS)]),
            this.entityManager.query<Array<CountRow>>(COUNT_PENDING_LEAVES, [workspaceId]),
            this.entityManager.query<Array<MinutesRow>>(SUM_MONTH_MINUTES, [workspaceId, month.from, month.to]),
        ])
        const current =
            scheduleRows.find((row) => row.status === "draft") ?? scheduleRows.find((row) => row.status === "published")
        const shifts = current === undefined ? [] : await this.data.scheduleShifts(workspaceId, current.id)
        return {
            weekFilled: shifts.filter((shift) => shift.staffId !== null).length,
            weekTotal: shifts.length,
            weekHasSchedule: current !== undefined,
            openGaps: Number(gaps[0]?.n ?? 0),
            leavePending: Number(leaves[0]?.n ?? 0),
            hoursMonth: Math.round(Number(minutes[0]?.minutes ?? 0) / 6) / 10,
        }
    }

    private async profileOfMember(
        workspaceId: string,
        userId: string,
        staffRowId: string | null,
    ): Promise<string | null> {
        const [row] = await this.entityManager.query<Array<ShiftsIdRow>>(SELECT_PROFILE_OF_MEMBER, [
            workspaceId,
            userId,
            staffRowId,
        ])
        return row?.id ?? null
    }
}
