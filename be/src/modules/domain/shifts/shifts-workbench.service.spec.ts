import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { Between, In } from "typeorm"
import { StaffDirectoryService } from "@modules/domain/staff"
import { AutomationPipelinesService } from "@modules/domain/automation-pipelines"
import type { PipelineRow } from "@modules/domain/automation-pipelines"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { routedQueryBuilder } from "@tests/fixtures/builders/routed-query.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { ShiftsErrorCode } from "./errors/shifts.error"
import {
    ShiftsAttendanceEntity,
    ShiftsAvailabilityEntity,
    ShiftsLeaveRequestEntity,
    ShiftsScheduleEntity,
    ShiftsShiftEntity,
    ShiftsStaffEntity,
    ShiftsSwapRequestEntity,
} from "./persistence/entities"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsWorkbenchService } from "./shifts-workbench.service"
import type { Env, Setup, Shift, ShiftStaff } from "./shifts.contracts"

import { SHIFT_STAFF, memberOf } from "@tests/fixtures/builders/shifts-workbench.builder"

/** 10:00 on Wednesday 14 October in Vietnam. */
const NOW = "2026-10-14T03:00:00.000Z"

const staffOf = builder<ShiftStaff>(SHIFT_STAFF)

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

const scheduleOf = entityOf(ShiftsScheduleEntity, {
    id: "schedule-2",
    weekStart: "2026-10-12",
    version: 2,
    status: "draft",
    source: "solver",
    costVnd: "120000",
    explanation: "Why",
    solverMs: 40,
    summary: { gaps: 0 },
    evidence: { source: "saved" },
    workItemId: "item-1",
    createdAt: new Date("2026-10-13T01:00:00.000Z"),
    publishedAt: null,
})

const shiftRowOf = entityOf(ShiftsShiftEntity, {
    id: "shift-1",
    shiftDate: "2026-10-14",
    startTime: "08:00:00",
    endTime: "10:00:00",
    positionId: "position-1",
    staffId: "profile-1",
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

const leaveOf = entityOf(ShiftsLeaveRequestEntity, {
    id: "leave-1",
    staffId: "profile-1",
    fromDate: "2026-10-20",
    toDate: "2026-10-21",
    reason: "Trip",
    status: "pending",
    workItemId: "item-2",
    createdAt: new Date("2026-10-13T02:00:00.000Z"),
})

const swapOf = entityOf(ShiftsSwapRequestEntity, {
    id: "swap-1",
    kind: "swap",
    shiftId: "shift-1",
    fromStaffId: "profile-1",
    toStaffId: "profile-2",
    reason: "Exam",
    status: "pending",
    checks: [],
    workItemId: null,
    createdAt: new Date("2026-10-13T03:00:00.000Z"),
})

const availabilityOf = entityOf(ShiftsAvailabilityEntity, {
    id: "avail-1",
    staffId: "profile-1",
    weekday: 2,
    shiftDate: null,
    startTime: "08:00:00",
    endTime: "12:00:00",
    available: false,
    note: "School",
    status: "approved",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})

const itemOf = (overrides: Record<string, unknown> = {}) => ({
    id: "item-1",
    status: "done",
    proposal: {},
    result: null,
    decided_path: null,
    ...overrides,
})

/** The reminder pipeline the owner of automations answers; the specs set its switch. */
const PIPELINE: PipelineRow = {
    id: "pipeline-1",
    workspace_id: "ws-1",
    template_key: "shifts_shift_reminder",
    name: "Reminder",
    module_key: "shifts",
    enabled: true,
    dismissed: false,
    config: {},
    body: null,
    body_version: 0,
    template_version: 1,
    based_on_context: null,
    approval_streak: 0,
    trust_offered_at: null,
    auto_send: false,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
}

/** What the reads answer: the rows of each entity, whether the member has a profile, the reminder switch and the figures. */
interface Answers {
    /** The work items the decision lookup answers. */
    readonly items?: ReadonlyArray<object>
    /** The active staff the directory answers. */
    readonly staff?: ReadonlyArray<{ readonly id: string; readonly name: string }>
    /** The rows `find` answers per entity; an entity not listed answers no rows. */
    readonly find?: ReadonlyMap<unknown, ReadonlyArray<object>>
    /** Whether the member has a shifts profile. */
    readonly profile?: boolean
    /** The reminder switch; null when the workspace has no pipeline row. */
    readonly reminder?: boolean | null
    /** The open published shifts counted. */
    readonly gaps?: number
    /** The pending leaves counted. */
    readonly pending?: number
    /** The scheduled minutes of the month. */
    readonly minutes?: string
}

const build = async (answers: Answers = {}, member: WorkspaceMember = memberOf()) => {
    const em = mockEntityManager()
    em.find.mockImplementation(((entity: unknown) => Promise.resolve(answers.find?.get(entity) ?? [])) as never)
    em.findOne.mockImplementation((() =>
        Promise.resolve(answers.profile === true ? entityOf(ShiftsStaffEntity, { id: "profile-1" })() : null)) as never)
    em.count.mockImplementation(((entity: unknown) =>
        Promise.resolve(entity === ShiftsShiftEntity ? (answers.gaps ?? 0) : (answers.pending ?? 0))) as never)
    em.createQueryBuilder.mockImplementation(() => {
        const fake: FakeQueryBuilder = routedQueryBuilder({
            getRawOne: () => Promise.resolve(answers.minutes === undefined ? undefined : { minutes: answers.minutes }),
        })
        return fake.builder as never
    })
    const pipelines = mock<AutomationPipelinesService>()
    pipelines.findPipeline.mockResolvedValue(
        answers.reminder === undefined || answers.reminder === null ? null : { ...PIPELINE, enabled: answers.reminder },
    )
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(member)
    const workItems = mock<WorkItemsService>()
    workItems.findMany.mockResolvedValue((answers.items ?? []) as never)
    const staff = mock<StaffDirectoryService>()
    staff.list.mockResolvedValue([...(answers.staff ?? [])])
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
            { provide: WorkItemsService, useValue: workItems },
            { provide: StaffDirectoryService, useValue: staff },
            { provide: AutomationPipelinesService, useValue: pipelines },
        ],
    }).compile()
    return { workbench: moduleRef.get(ShiftsWorkbenchService), em, members, data, workItems, staff, pipelines }
}

const managerBenchRows: Answers = {
    profile: true,
    reminder: true,
    gaps: 3,
    pending: 2,
    minutes: "750",
    items: [itemOf({ id: "item-1", status: "waiting_decision", proposal: { summary: "Publish" } })],
    staff: [{ id: "staff-row-1", name: "Lan" }],
    find: new Map<unknown, ReadonlyArray<object>>([
        [
            ShiftsScheduleEntity,
            [scheduleOf(), scheduleOf({ id: "schedule-1", version: 1, status: "published", workItemId: null })],
        ],
        [ShiftsAttendanceEntity, [{ shiftId: "shift-1", checkedInAt: new Date("2026-10-14T00:55:00.000Z") }]],
        [ShiftsSwapRequestEntity, [swapOf()]],
        [ShiftsShiftEntity, [shiftRowOf()]],
    ]),
}

describe("ShiftsWorkbenchService", () => {
    it.each<[unknown, unknown, boolean]>([
        [{ summary: 1 }, {}, false],
        [0, false, true],
        ["bad", "bad", true],
        [undefined, undefined, true],
        [null, null, true],
        [[], [], true],
    ])(
        "maps missing timestamps and malformed work-item JSON %j / %j (null dates=%s)",
        async (proposal, result, nullDates) => {
            const item = itemOf({ proposal, result })
            const published = new Date("2026-10-13T02:00:00.000Z")
            const dateOf = (date: Date | string): Date | string | null => (nullDates ? null : date)
            const dated = <Row extends { createdAt: Date | string }>(row: Row) => ({
                ...row,
                createdAt: dateOf(row.createdAt),
            })
            const schedule = dated(scheduleOf({ status: "published", costVnd: "0", summary: null, evidence: null }))
            const missingLeave = dated(leaveOf({ id: "leave-2", workItemId: "absent" }))
            const missingSwap = dated(swapOf({ id: "swap-2", shiftId: "absent", workItemId: "absent" }))
            const { workbench, data } = await build({
                find: new Map<unknown, ReadonlyArray<object>>([
                    [ShiftsScheduleEntity, [{ ...schedule, workItemId: "absent", publishedAt: published }]],
                    [ShiftsLeaveRequestEntity, [leaveOf({ workItemId: null }), missingLeave]],
                    [
                        ShiftsSwapRequestEntity,
                        [swapOf({ workItemId: "item-1", checks: ["Notice short"] }), missingSwap],
                    ],
                    [ShiftsAvailabilityEntity, [dated(availabilityOf())]],
                    [ShiftsAttendanceEntity, [{ shiftId: "shift-1", checkedInAt: dateOf("2026-10-14T00:55:00.000Z") }]],
                    [ShiftsShiftEntity, [shiftRowOf({ positionId: "absent" })]],
                ]),
                items: [item],
            })
            const segs = [{ date: "2026-10-11", s: 480, e: 600, pos: "position-1" }]
            data.loadEnv.mockResolvedValue({ ...ENV, prior: new Map([["profile-1", segs]]) })
            const view = await workbench.bench("user-1", "ws-1")
            expect(view.week.prior).toEqual([{ staffId: "profile-1", segs }])
            expect(view.week.current).toMatchObject({ costVnd: 0, summary: {}, evidence: {} })
            expect(view.week.current?.publishedAt).toBe("2026-10-13T02:00:00.000Z")
            expect(view.week.versions[0]?.publishedAt).toBe("2026-10-13T02:00:00.000Z")
            expect(view.week.current?.createdAt).toBe(nullDates ? "" : "2026-10-13T01:00:00.000Z")
            expect(view.week.versions[0]?.createdAt).toBe(nullDates ? "" : "2026-10-13T01:00:00.000Z")
            expect(view.week.checkins).toEqual([
                { shiftId: "shift-1", checkedInAt: nullDates ? "" : "2026-10-14T00:55:00.000Z" },
            ])
            expect(view.requests.leaves[1]?.createdAt).toBe(nullDates ? "" : "2026-10-13T02:00:00.000Z")
            expect(view.requests.swaps[1]?.createdAt).toBe(nullDates ? "" : "2026-10-13T03:00:00.000Z")
            expect(view.allAvailability[0]?.createdAt).toBe(nullDates ? "" : "2026-10-01T00:00:00.000Z")
            expect(view.requests.availability[0]?.createdAt).toBe(nullDates ? "" : "2026-10-01T00:00:00.000Z")
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
            expect(view.requests.swaps.map((row) => row.shiftLine)).toEqual(["14/10 08:00–10:00", "—"])
        },
    )
})

describe("ShiftsWorkbenchService bench", () => {
    it("refuses a week that is not a day before reading anything", async () => {
        const { workbench, members } = await build()
        await expect(workbench.bench("user-1", "ws-1", "next week")).rejects.toMatchObject({
            code: ShiftsErrorCode.WeekInvalid,
        })
        expect(members.require).not.toHaveBeenCalled()
    })
})

describe("ShiftsWorkbenchService bench", () => {
    it("shows a manager the current draft, its attendance, the requests and the figures of the week", async () => {
        const { workbench, data, em } = await build(managerBenchRows)

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
        expect(em.find).toHaveBeenCalledWith(
            ShiftsScheduleEntity,
            expect.objectContaining({
                where: { workspaceId: "ws-1", weekStart: "2026-10-12" },
                order: { version: "DESC" },
                take: 20,
            }),
        )
        expect(em.find).toHaveBeenCalledWith(
            ShiftsSwapRequestEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1" }, order: { createdAt: "DESC" }, take: 200 }),
        )
        expect(em.find).toHaveBeenCalledWith(
            ShiftsAttendanceEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", shiftId: In(["shift-1", "shift-2"]) } }),
        )
        expect(em.count).toHaveBeenCalledWith(ShiftsLeaveRequestEntity, {
            where: { workspaceId: "ws-1", status: "pending" },
        })
    })
})

describe("ShiftsWorkbenchService bench", () => {
    it("hides a draft from staff and reads only their own requests", async () => {
        const staff = memberOf({ role: "staff" })
        const { workbench, em, data } = await build(
            { profile: true, find: new Map<unknown, ReadonlyArray<object>>([[ShiftsScheduleEntity, [scheduleOf()]]]) },
            staff,
        )

        const view = await workbench.bench("user-1", "ws-1", "2026-10-22")

        expect(view).toMatchObject({ role: "staff", staffRows: [], allAvailability: [], figures: null })
        expect(view.week).toMatchObject({ monday: "2026-10-19", current: null, shifts: [], checkins: [] })
        expect(data.loadSetup).toHaveBeenCalledWith("ws-1", false)
        expect(em.find).toHaveBeenCalledWith(
            ShiftsScheduleEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", weekStart: "2026-10-19" } }),
        )
        expect(em.find).toHaveBeenCalledWith(
            ShiftsLeaveRequestEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", staffId: "profile-1" } }),
        )
        expect(em.find).toHaveBeenCalledWith(
            ShiftsSwapRequestEntity,
            expect.objectContaining({
                where: [
                    { workspaceId: "ws-1", fromStaffId: "profile-1" },
                    { workspaceId: "ws-1", toStaffId: "profile-1" },
                ],
            }),
        )
        expect(em.find).toHaveBeenCalledWith(
            ShiftsAvailabilityEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", staffId: "profile-1" } }),
        )
        expect(em.find).not.toHaveBeenCalledWith(ShiftsAttendanceEntity, expect.anything())
    })

    it("shows staff a published schedule without its summary and evidence", async () => {
        const { workbench } = await build(
            {
                profile: true,
                find: new Map<unknown, ReadonlyArray<object>>([
                    [ShiftsScheduleEntity, [scheduleOf({ status: "published", workItemId: null })]],
                ]),
            },
            memberOf({ role: "staff" }),
        )

        const view = await workbench.bench("user-1", "ws-1")

        expect(view.week.current).toMatchObject({ id: "schedule-2", summary: {}, evidence: {} })
        expect(view.week.shifts).toHaveLength(2)
    })

    it("filters the requests of a member without a profile to nobody", async () => {
        const { workbench, em } = await build({}, memberOf({ role: "staff", staffId: null }))

        const view = await workbench.bench("user-1", "ws-1")

        expect(view.myProfileId).toBeNull()
        expect(view.reminderOn).toBe(false)
        expect(em.findOne).toHaveBeenCalledWith(
            ShiftsStaffEntity,
            expect.objectContaining({ where: [{ workspaceId: "ws-1", active: true, userId: "user-1" }] }),
        )
        expect(em.find).toHaveBeenCalledWith(
            ShiftsLeaveRequestEntity,
            expect.objectContaining({
                where: { workspaceId: "ws-1", staffId: "00000000-0000-0000-0000-000000000000" },
            }),
        )
    })
})

describe("ShiftsWorkbenchService bench", () => {
    it("lists leave with its work item and every availability statement for a manager", async () => {
        const { workbench } = await build({
            find: new Map<unknown, ReadonlyArray<object>>([
                [ShiftsLeaveRequestEntity, [leaveOf()]],
                [ShiftsAvailabilityEntity, [availabilityOf()]],
            ]),
            items: [
                itemOf({
                    id: "item-2",
                    status: "done",
                    proposal: null,
                    result: { summary: "Approved" },
                    decided_path: "human",
                }),
            ],
        })

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

describe("ShiftsWorkbenchService mine", () => {
    it.each([false, true])("answers an empty schedule page (member profile=%s)", async (hasProfile) => {
        const { workbench, data, em } = await build({ profile: hasProfile })

        await expect(workbench.mine("user-1", "ws-1")).resolves.toEqual({
            profileId: hasProfile ? "profile-1" : null,
            today: "2026-10-14",
            myShifts: [],
            openShifts: [],
            colleagues: hasProfile ? [{ id: "profile-2", name: "Binh", positionIds: ["position-1"] }] : [],
            availability: [],
            leaves: [],
            swaps: [],
        })
        if (hasProfile) expect(em.find).not.toHaveBeenCalledWith(ShiftsAttendanceEntity, expect.anything())
        else expect(data.loadSetup).not.toHaveBeenCalled()
    })

    it("lists the member's next shifts with check-ins, the open shifts and the active colleagues", async () => {
        const { workbench, em } = await build({
            profile: true,
            find: new Map<unknown, ReadonlyArray<object>>([
                [
                    ShiftsShiftEntity,
                    [
                        shiftRowOf(),
                        shiftRowOf({ id: "shift-2", staffId: null }),
                        shiftRowOf({ id: "shift-3", staffId: "profile-2" }),
                        shiftRowOf({ id: "shift-4", shiftDate: "2026-10-15" }),
                    ],
                ],
                [ShiftsAttendanceEntity, [{ shiftId: "shift-1", checkedInAt: new Date("2026-10-14T00:55:00.000Z") }]],
            ]),
        })

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
        expect(em.find).toHaveBeenCalledWith(
            ShiftsShiftEntity,
            expect.objectContaining({
                where: {
                    workspaceId: "ws-1",
                    shiftDate: Between("2026-10-14", "2026-10-28"),
                    status: In(["published", "swapped"]),
                },
                order: { shiftDate: "ASC", startTime: "ASC" },
                take: 2000,
            }),
        )
        expect(em.find).toHaveBeenCalledWith(
            ShiftsAttendanceEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", shiftId: In(["shift-1", "shift-4"]) } }),
        )
    })
})
