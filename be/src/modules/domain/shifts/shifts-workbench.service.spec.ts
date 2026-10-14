import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ShiftsErrorCode } from "./errors/shifts.error"
import type {
    WorkbenchAvailabilityRow,
    WorkbenchLeaveRow,
    WorkbenchScheduleRow,
    WorkbenchShiftRow,
    WorkbenchSwapRow,
} from "./persistence/shifts-workbench.rows"
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
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsWorkbenchService } from "./shifts-workbench.service"
import type { Env, Setup, Shift, ShiftStaff } from "./shifts.contracts"

/** 10:00 on Wednesday 14 October in Vietnam. */
const NOW = "2026-10-14T03:00:00.000Z"

const staffOf = builder<ShiftStaff>({
    id: "profile-1",
    name: "Alex",
    positionIds: ["position-1"],
    skills: [],
    wage: 30000,
    maxWeek: 40,
    maxDay: 8,
    minRest: 12,
    staffRowId: null,
    telegramChatId: null,
    zaloUserId: null,
    phone: null,
    active: true,
})

const SETUP: Setup = {
    positions: [{ id: "position-1", name: "Cashier", color: "#ff0000" }],
    staff: [staffOf(), staffOf({ id: "profile-2", name: "Binh" }), staffOf({ id: "profile-3", active: false })],
    blocks: [],
    settings: {
        openingHours: [],
        swapNoticeHours: 12,
        leaveNoticeDays: 3,
        remindMinutes: 60,
        noshowMinutes: 15,
        overtimeHoursWeek: 40,
    },
}

const ENV: Env = { staff: new Map(), avail: [], leaves: [], overtimeHoursWeek: 40 }

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: "staff-row-1",
    displayName: "Lan",
    status: "active",
})

const scheduleOf = builder<WorkbenchScheduleRow>({
    id: "schedule-2",
    week_start: "2026-10-12",
    version: 2,
    status: "draft",
    source: "solver",
    cost_vnd: "120000",
    explanation: "Why",
    solver_ms: 40,
    summary: { gaps: 0 },
    evidence: { source: "saved" },
    work_item_id: "item-1",
    created_at: new Date("2026-10-13T01:00:00.000Z"),
    published_at: null,
})

const shiftRowOf = builder<WorkbenchShiftRow>({
    id: "shift-1",
    shift_date: "2026-10-14",
    start_time: "08:00:00",
    end_time: "10:00:00",
    position_id: "position-1",
    staff_id: "profile-1",
    status: "published",
})

const shiftOf = (overrides: Partial<Shift> = {}): Shift => ({
    id: "shift-1",
    date: "2026-10-14",
    start: "08:00",
    end: "10:00",
    positionId: "position-1",
    staffId: "profile-1",
    status: "published",
    ...overrides,
})

const leaveOf = builder<WorkbenchLeaveRow>({
    id: "leave-1",
    staff_id: "profile-1",
    from_date: "2026-10-20",
    to_date: "2026-10-21",
    reason: "Trip",
    status: "pending",
    work_item_id: "item-2",
    created_at: "2026-10-13T02:00:00.000Z",
})

const swapOf = builder<WorkbenchSwapRow>({
    id: "swap-1",
    kind: "swap",
    shift_id: "shift-1",
    from_staff_id: "profile-1",
    to_staff_id: "profile-2",
    reason: "Exam",
    status: "pending",
    checks: null,
    work_item_id: null,
    created_at: "2026-10-13T03:00:00.000Z",
})

const availabilityOf = builder<WorkbenchAvailabilityRow>({
    id: "avail-1",
    staff_id: "profile-1",
    weekday: 2,
    shift_date: null,
    start_time: "08:00:00",
    end_time: "12:00:00",
    available: false,
    note: "School",
    status: "approved",
    created_at: "2026-10-01T00:00:00.000Z",
})

/** What each statement answers; a statement not listed answers no rows. */
type Answers = ReadonlyMap<string, ReadonlyArray<object>>

const build = async (answers: Answers, member: WorkspaceMember = memberOf()) => {
    const em = mockEntityManager()
    em.query.mockImplementation((sql: string) => Promise.resolve(answers.get(sql) ?? []))
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(member)
    const data = mock<ShiftsDataService>()
    data.loadSetup.mockResolvedValue(SETUP)
    data.loadEnv.mockResolvedValue(ENV)
    data.scheduleShifts.mockResolvedValue([shiftOf(), shiftOf({ id: "shift-2", staffId: null })])
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsWorkbenchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ShiftsDataService, useValue: data },
        ],
    }).compile()
    return { workbench: moduleRef.get(ShiftsWorkbenchService), em, members, data }
}

const PROFILE = [SELECT_PROFILE_OF_MEMBER, [{ id: "profile-1" }]] as const

describe("ShiftsWorkbenchService", () => {
    it("maps a published manager week and requests whose optional details are missing", async () => {
        const item = { id: "item-1", status: "done", proposal: { summary: 1 }, result: {}, decided_path: null }
        const published = new Date("2026-10-13T02:00:00.000Z")
        const schedule = scheduleOf({ status: "published", cost_vnd: 0, summary: null, evidence: null })
        const missingLeave = leaveOf({ id: "leave-2", work_item_id: "absent" })
        const missingSwap = swapOf({ id: "swap-2", shift_id: "absent", work_item_id: "absent" })
        const { workbench } = await build(
            new Map<string, ReadonlyArray<object>>([
                [SELECT_WEEK_SCHEDULES, [{ ...schedule, work_item_id: "absent", published_at: published }]],
                [SELECT_LEAVES, [leaveOf({ work_item_id: null }), missingLeave]],
                [SELECT_SWAPS, [swapOf({ work_item_id: "item-1", checks: ["Notice short"] }), missingSwap]],
                [SELECT_SHIFTS_BY_IDS, [shiftRowOf({ position_id: "absent" })]],
                [SELECT_WORK_ITEMS, [item]],
            ]),
        )

        const view = await workbench.bench("user-1", "ws-1")

        expect(view.week.current).toMatchObject({ costVnd: 0, summary: {}, evidence: {} })
        expect(view.week.current?.publishedAt).toBe("2026-10-13T02:00:00.000Z")
        expect(view.week.versions[0]?.publishedAt).toBe("2026-10-13T02:00:00.000Z")
        expect(view.week.publishItem).toBeNull()
        expect(view.requests.leaves.map((row) => row.item)).toEqual([null, null])
        expect(view.requests.swaps[0]?.checks).toEqual(["Notice short"])
        expect(view.requests.swaps[0]?.item).toEqual({
            id: "item-1",
            status: "done",
            summary: "",
            resultSummary: null,
            decidedPath: null,
        })
        expect(view.requests.swaps[1]?.item).toBeNull()
        expect(view.requests.swaps.map((row) => row.shiftLine)).toEqual(["14/10 08:00\u201310:00", "\u2014"])
    })

    describe("bench", () => {
        it("refuses a week that is not a day before reading anything", async () => {
            const { workbench, members } = await build(new Map())

            await expect(workbench.bench("user-1", "ws-1", "next week")).rejects.toMatchObject({
                code: ShiftsErrorCode.WeekInvalid,
            })
            expect(members.require).not.toHaveBeenCalled()
        })

        it("shows a manager the current draft, its attendance, the requests and the figures of the week", async () => {
            const { workbench, data } = await build(
                new Map<string, ReadonlyArray<object>>([
                    PROFILE,
                    [SELECT_REMINDER_ON, [{ enabled: true }]],
                    [
                        SELECT_WEEK_SCHEDULES,
                        [
                            scheduleOf(),
                            scheduleOf({ id: "schedule-1", version: 1, status: "published", work_item_id: null }),
                        ],
                    ],
                    [SELECT_ATTENDANCE, [{ shift_id: "shift-1", checked_in_at: new Date("2026-10-14T00:55:00.000Z") }]],
                    [
                        SELECT_WORK_ITEMS,
                        [
                            {
                                id: "item-1",
                                status: "waiting_decision",
                                proposal: { summary: "Publish" },
                                result: null,
                                decided_path: null,
                            },
                        ],
                    ],
                    [SELECT_SHOP_STAFF, [{ id: "staff-row-1", name: "Lan" }]],
                    [SELECT_SWAPS, [swapOf()]],
                    [SELECT_SHIFTS_BY_IDS, [shiftRowOf()]],
                    [COUNT_OPEN_GAPS, [{ n: "3" }]],
                    [COUNT_PENDING_LEAVES, [{ n: 2 }]],
                    [SUM_MONTH_MINUTES, [{ minutes: "750" }]],
                ]),
            )

            const view = await workbench.bench("user-1", "ws-1")

            expect(view).toMatchObject({
                role: "manager",
                today: "2026-10-14",
                myProfileId: "profile-1",
                reminderOn: true,
                staffRows: [{ id: "staff-row-1", name: "Lan" }],
                figures: {
                    weekFilled: 1,
                    weekTotal: 2,
                    weekHasSchedule: true,
                    openGaps: 3,
                    leavePending: 2,
                    hoursMonth: 12.5,
                },
            })
            expect(view.week).toMatchObject({
                monday: "2026-10-12",
                versions: [
                    {
                        id: "schedule-2",
                        version: 2,
                        status: "draft",
                        costVnd: 120000,
                        createdAt: "2026-10-13T01:00:00.000Z",
                        publishedAt: null,
                    },
                    {
                        id: "schedule-1",
                        version: 1,
                        status: "published",
                        costVnd: 120000,
                        createdAt: "2026-10-13T01:00:00.000Z",
                        publishedAt: null,
                    },
                ],
                current: { id: "schedule-2", summary: { gaps: 0 }, evidence: { source: "saved" } },
                shifts: [shiftOf(), shiftOf({ id: "shift-2", staffId: null })],
                publishItem: {
                    id: "item-1",
                    status: "waiting_decision",
                    summary: "Publish",
                    resultSummary: null,
                    decidedPath: null,
                },
                checkins: [{ shiftId: "shift-1", checkedInAt: "2026-10-14T00:55:00.000Z" }],
                prior: [],
            })
            expect(view.requests.swaps).toEqual([
                {
                    id: "swap-1",
                    kind: "swap",
                    shiftId: "shift-1",
                    fromStaffId: "profile-1",
                    toStaffId: "profile-2",
                    reason: "Exam",
                    status: "pending",
                    checks: [],
                    workItemId: null,
                    createdAt: "2026-10-13T03:00:00.000Z",
                    item: null,
                    shiftLine: "14/10 08:00–10:00 Cashier",
                },
            ])
            expect(data.loadSetup).toHaveBeenCalledWith("ws-1", true)
            expect(data.scheduleShifts).toHaveBeenCalledWith("ws-1", "schedule-2")
        })

        it("hides a draft from staff and reads only their own requests", async () => {
            const staff = memberOf({ role: "staff" })
            const { workbench, em, data } = await build(
                new Map<string, ReadonlyArray<object>>([PROFILE, [SELECT_WEEK_SCHEDULES, [scheduleOf()]]]),
                staff,
            )

            const view = await workbench.bench("user-1", "ws-1", "2026-10-22")

            expect(view).toMatchObject({ role: "staff", staffRows: [], allAvailability: [], figures: null })
            expect(view.week).toMatchObject({ monday: "2026-10-19", current: null, shifts: [], checkins: [] })
            expect(data.loadSetup).toHaveBeenCalledWith("ws-1", false)
            expect(em.query).toHaveBeenCalledWith(SELECT_WEEK_SCHEDULES, ["ws-1", "2026-10-19"])
            expect(em.query).toHaveBeenCalledWith(SELECT_LEAVES, ["ws-1", "profile-1"])
            expect(em.query).not.toHaveBeenCalledWith(SELECT_ATTENDANCE, ["ws-1", ["shift-1", "shift-2"]])
        })

        it("shows staff a published schedule without its summary and evidence", async () => {
            const { workbench } = await build(
                new Map<string, ReadonlyArray<object>>([
                    PROFILE,
                    [SELECT_WEEK_SCHEDULES, [scheduleOf({ status: "published", work_item_id: null })]],
                ]),
                memberOf({ role: "staff" }),
            )

            const view = await workbench.bench("user-1", "ws-1")

            expect(view.week.current).toMatchObject({ id: "schedule-2", summary: {}, evidence: {} })
            expect(view.week.shifts).toHaveLength(2)
        })

        it("filters the requests of a member without a profile to nobody", async () => {
            const { workbench, em } = await build(new Map(), memberOf({ role: "staff", staffId: null }))

            const view = await workbench.bench("user-1", "ws-1")

            expect(view.myProfileId).toBeNull()
            expect(view.reminderOn).toBe(false)
            expect(em.query).toHaveBeenCalledWith(SELECT_PROFILE_OF_MEMBER, ["ws-1", "user-1", null])
            expect(em.query).toHaveBeenCalledWith(SELECT_LEAVES, ["ws-1", "00000000-0000-0000-0000-000000000000"])
        })

        it("lists leave with its work item and every availability statement for a manager", async () => {
            const { workbench } = await build(
                new Map<string, ReadonlyArray<object>>([
                    [SELECT_LEAVES, [leaveOf()]],
                    [
                        SELECT_WORK_ITEMS,
                        [
                            {
                                id: "item-2",
                                status: "done",
                                proposal: null,
                                result: { summary: "Approved" },
                                decided_path: "human",
                            },
                        ],
                    ],
                    [SELECT_ALL_AVAILABILITY, [availabilityOf()]],
                ]),
            )

            const view = await workbench.bench("user-1", "ws-1")

            expect(view.requests.leaves).toEqual([
                {
                    id: "leave-1",
                    staffId: "profile-1",
                    from: "2026-10-20",
                    to: "2026-10-21",
                    reason: "Trip",
                    status: "pending",
                    workItemId: "item-2",
                    createdAt: "2026-10-13T02:00:00.000Z",
                    item: {
                        id: "item-2",
                        status: "done",
                        summary: "",
                        resultSummary: "Approved",
                        decidedPath: "human",
                    },
                },
            ])
            const statement = {
                id: "avail-1",
                staffId: "profile-1",
                weekday: 2,
                date: null,
                start: "08:00",
                end: "12:00",
                available: false,
                note: "School",
                status: "approved",
                createdAt: "2026-10-01T00:00:00.000Z",
            }
            expect(view.allAvailability).toEqual([statement])
            expect(view.requests.availability).toEqual([statement])
            expect(view.figures).toEqual({
                weekFilled: 0,
                weekTotal: 0,
                weekHasSchedule: false,
                openGaps: 0,
                leavePending: 0,
                hoursMonth: 0,
            })
        })
    })

    describe("mine", () => {
        it("answers an empty page for a member without a shifts profile", async () => {
            const { workbench, data } = await build(new Map())

            await expect(workbench.mine("user-1", "ws-1")).resolves.toEqual({
                profileId: null,
                today: "2026-10-14",
                myShifts: [],
                openShifts: [],
                colleagues: [],
                availability: [],
                leaves: [],
                swaps: [],
            })
            expect(data.loadSetup).not.toHaveBeenCalled()
        })

        it("lists the member's next shifts with check-ins, the open shifts and the active colleagues", async () => {
            const { workbench, em } = await build(
                new Map<string, ReadonlyArray<object>>([
                    PROFILE,
                    [
                        SELECT_POSTED_SHIFTS,
                        [
                            shiftRowOf(),
                            shiftRowOf({ id: "shift-2", staff_id: null }),
                            shiftRowOf({ id: "shift-3", staff_id: "profile-2" }),
                            shiftRowOf({ id: "shift-4", shift_date: "2026-10-15" }),
                        ],
                    ],
                    [SELECT_ATTENDANCE, [{ shift_id: "shift-1", checked_in_at: "2026-10-14T00:55:00.000Z" }]],
                ]),
            )

            await expect(workbench.mine("user-1", "ws-1")).resolves.toEqual({
                profileId: "profile-1",
                today: "2026-10-14",
                myShifts: [
                    { ...shiftOf(), checkedIn: true },
                    { ...shiftOf({ id: "shift-4", date: "2026-10-15" }), checkedIn: false },
                ],
                openShifts: [shiftOf({ id: "shift-2", staffId: null })],
                colleagues: [{ id: "profile-2", name: "Binh", positionIds: ["position-1"] }],
                availability: [],
                leaves: [],
                swaps: [],
            })
            expect(em.query).toHaveBeenCalledWith(SELECT_POSTED_SHIFTS, ["ws-1", "2026-10-14", "2026-10-28"])
            expect(em.query).toHaveBeenCalledWith(SELECT_ATTENDANCE, ["ws-1", ["shift-1", "shift-4"]])
        })

        it("reads no attendance when the member has no shifts ahead", async () => {
            const { workbench, em } = await build(new Map<string, ReadonlyArray<object>>([PROFILE]))

            await expect(workbench.mine("user-1", "ws-1")).resolves.toMatchObject({ myShifts: [], openShifts: [] })
            expect(em.query).not.toHaveBeenCalledWith(SELECT_ATTENDANCE, ["ws-1", []])
        })
    })
})
