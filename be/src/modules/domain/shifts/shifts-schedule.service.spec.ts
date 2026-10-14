import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ApprovalGate, ModuleTextGenerator } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ShiftsErrorCode } from "./errors/shifts.error"
import type { ShiftsScheduleRow, ShiftsShiftRow } from "./persistence/shifts.rows"
import {
    ADD_SHIFTS,
    LINK_SCHEDULE,
    REASSIGN_SHIFT,
    REMOVE_SHIFT,
    SAVE_SCHEDULE,
    SET_EXPLANATION,
} from "./persistence/shifts.sql"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsScheduleService } from "./shifts-schedule.service"
import type { ProposeWeekOutput } from "./shifts-operations.contracts"
import { ShiftsTextService } from "./shifts-text.service"
import type { Block, Env, Setup, Shift, ShiftStaff } from "./shifts.contracts"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const staffOf = builder<ShiftStaff>({
    id: "staff-1",
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
const blockOf = builder<Block>({
    id: "block-1",
    weekday: 0,
    start: "08:00",
    end: "10:00",
    positionId: "position-1",
    min: 1,
    ideal: 1,
    peak: false,
})
const setupOf = builder<Setup>({
    positions: [{ id: "position-1", name: "Cashier", color: "#ff0000" }],
    staff: [staffOf({ id: "inactive-1", active: false }), staffOf()],
    blocks: [blockOf()],
    settings: {
        openingHours: [],
        swapNoticeHours: 12,
        leaveNoticeDays: 3,
        remindMinutes: 60,
        noshowMinutes: 15,
        overtimeHoursWeek: 40,
    },
})
const envOf = builder<Env>({
    staff: new Map([["staff-1", staffOf()]]),
    avail: [],
    leaves: [],
    overtimeHoursWeek: 40,
})
const scheduleOf = builder<ShiftsScheduleRow>({
    id: "schedule-1",
    week_start: "2026-10-12",
    version: 3,
    status: "draft",
    cost_vnd: "60000.4",
    summary: {},
    evidence: { source: "saved" },
})
const shiftOf = builder<Shift>({
    id: "shift-1",
    date: "2026-10-12",
    start: "08:00",
    end: "10:00",
    positionId: "position-1",
    staffId: "staff-1",
    status: "draft",
})

const proposalOf = builder<ProposeWeekOutput>({
    scheduleId: "schedule-1",
    version: 3,
    shifts: 1,
    open: 0,
    short: 0,
    costVnd: 60000,
    ms: 0,
    iterations: 6,
})

const savedCoverage =
    '{"coverage":[{"blockId":"block-1","date":"2026-10-12","positionId":"position-1","start":"08:00","end":"10:00","min":1,"ideal":1,"peak":false,"have":1,"status":"ok"}],"hours":[{"staffId":"staff-1","hours":2}]}'
const savedSolver =
    '{"solver":{"ms":0,"iterations":6,"costVnd":60000,"shiftCount":1,"openCount":0,"shortages":[],"hoursByStaff":[{"staffId":"staff-1","hours":2}],"askCandidates":[]}}'

const emptyInsertion = [
    SET_EXPLANATION,
    [
        "ws-1",
        "schedule-1",
        text("shifts.explain.fallback", {
            week: "week:2026-10-12",
            version: 1,
            shifts: 0,
            open: 0,
            cost: "0\u0111",
            short: "shifts.explain.shortNone{}",
        }),
        "{}",
    ],
]
const shortageInsertion = [
    ADD_SHIFTS,
    [
        "ws-1",
        "schedule-1",
        ["2026-10-12", "2026-10-12"],
        ["08:00", "08:00"],
        ["10:00", "10:00"],
        ["position-1", "position-1"],
        ["staff-1", null],
        "solver",
    ],
]

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "manager",
        staffId: null,
        displayName: "Alex",
        status: "active",
    })
    const data = mock<ShiftsDataService>()
    data.loadSetup.mockResolvedValue(setupOf())
    data.loadEnv.mockResolvedValue(envOf())
    data.scheduleRow.mockResolvedValue(scheduleOf())
    data.scheduleShifts.mockResolvedValue([shiftOf()])
    data.askAttempts.mockResolvedValue(1)
    const words = mock<ShiftsTextService>()
    words.text.mockImplementation(text)
    words.week.mockImplementation((monday) => `week:${monday}`)
    words.findings.mockImplementation((list) =>
        list.map((item) => text(`shifts.finding.${item.code}`, { ...item.params })),
    )
    const generator = mock<ModuleTextGenerator>()
    generator.generate.mockResolvedValue({ ok: false, output: "" })
    const gate = mock<ApprovalGate>()
    gate.request.mockResolvedValue({ status: "done", workItemId: "work-1" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsScheduleService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T08:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ShiftsDataService, useValue: data },
            { provide: ShiftsTextService, useValue: words },
            { provide: ModuleTextGenerator, useValue: generator },
            { provide: ApprovalGate, useValue: gate },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsScheduleService), members, data, words, generator, gate }
}

const shiftRowOf = builder<ShiftsShiftRow>({
    id: "shift-1",
    schedule_id: "schedule-1",
    shift_date: "2026-10-12",
    start_time: "08:00",
    end_time: "10:00",
    position_id: "position-1",
    staff_id: "staff-1",
    status: "draft",
    schedule_status: "draft",
    week_start: "2026-10-12",
})
const addRequest = {
    scheduleId: "schedule-1",
    date: "2026-10-12",
    start: "08:00",
    end: "10:00",
    positionId: "position-1",
    staffId: "staff-1",
}

/** The service with a draft shift on file, an empty week around it and no staff in its environment. */
const buildEdits = async (entityManager: MockEntityManager) => {
    const built = await build(entityManager)
    built.data.shiftRow.mockResolvedValue(shiftRowOf())
    built.data.scheduleShifts.mockResolvedValue([])
    built.data.loadEnv.mockResolvedValue(envOf({ staff: new Map() }))
    return built
}

describe("ShiftsScheduleService", () => {
    it("proposeWeek: solves and saves the containing week with exact shifts and evidence", async () => {
        const em = mockEntityManager({
            query: [
                [SAVE_SCHEDULE, [{ id: "schedule-1" }]],
                [ADD_SHIFTS, []],
                [SET_EXPLANATION, []],
            ],
        })
        const { service, members, data, generator } = await build(em)
        data.loadEnv.mockResolvedValue(envOf({ prior: new Map() }))
        generator.generate.mockResolvedValue({ ok: true, output: "  A balanced week.  " })

        await expect(service.proposeWeek("user-1", "ws-1", { week: "2026-10-15" })).resolves.toEqual(proposalOf())

        expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
        expect(data.loadSetup.mock.calls).toEqual([["ws-1", true]])
        expect(data.loadEnv.mock.calls).toEqual([["ws-1", "2026-10-12", setupOf()]])
        expect(em.query.mock.calls).toEqual([
            [SAVE_SCHEDULE, ["ws-1", "2026-10-12", 60000, savedCoverage, savedSolver, 0, "Alex"]],
            [
                ADD_SHIFTS,
                ["ws-1", "schedule-1", ["2026-10-12"], ["08:00"], ["10:00"], ["position-1"], ["staff-1"], "solver"],
            ],
            [SET_EXPLANATION, ["ws-1", "schedule-1", "A balanced week.", JSON.stringify({ source: "saved" })]],
        ])
        expect(generator.generate.mock.calls).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    purpose: "shifts_explain",
                    module: "shifts",
                    system: "shifts.explain.system{}",
                    user: text("shifts.explain.user", {
                        week: "week:2026-10-12",
                        version: 3,
                        shifts: 1,
                        open: 0,
                        cost: "60.000\u0111",
                        short: "shifts.explain.shortNone{}",
                    }),
                    timeoutMs: 15000,
                },
            ],
        ])
    })

    it.each([
        { empty: true, min: 0, output: proposalOf({ version: 1, shifts: 0, costVnd: 0 }) },
        { empty: false, min: 2, output: proposalOf({ open: 1, short: 1 }) },
    ])("proposeWeek: saves empty=$empty coverage and exact inserted shifts", async ({ empty, min, output }) => {
        const em = mockEntityManager({
            query: [
                [SAVE_SCHEDULE, [{ id: "schedule-1" }]],
                [ADD_SHIFTS, []],
                [SET_EXPLANATION, []],
            ],
        })
        const { service, data } = await build(em)
        data.loadSetup.mockResolvedValue(setupOf({ blocks: [blockOf({ min, ideal: min })] }))
        data.scheduleRow.mockResolvedValue(empty ? undefined : scheduleOf())
        await expect(service.proposeWeek("user-1", "ws-1", { week: "2026-10-12" })).resolves.toEqual(output)
        expect(em.query.mock.calls).toHaveLength(empty ? 2 : 3)
        expect(em.query.mock.calls[1]).toEqual(empty ? emptyInsertion : shortageInsertion)
    })

    it("proposeWeek: refuses an invalid week before reading setup", async () => {
        const em = mockEntityManager({})
        const { service, data } = await build(em)

        await expect(service.proposeWeek("user-1", "ws-1", { week: "2026-02-30" })).rejects.toMatchObject({
            code: ShiftsErrorCode.WeekInvalid,
        })

        expect(data.loadSetup).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalled()
    })

    it.each([
        { setup: setupOf({ staff: [staffOf({ active: false })] }), code: ShiftsErrorCode.NoStaff },
        { setup: setupOf({ blocks: [] }), code: ShiftsErrorCode.NoCoverage },
    ])("proposeWeek: refuses an unusable setup with $code", async ({ setup, code }) => {
        const { service, data } = await build(mockEntityManager({}))
        data.loadSetup.mockResolvedValue(setup)
        await expect(service.proposeWeek("user-1", "ws-1", { week: "2026-10-12" })).rejects.toMatchObject({ code })
    })

    it.each([{ rows: [] }, { rows: [{ id: null }] }])(
        "proposeWeek: refuses a save without an id from %j",
        async ({ rows }) => {
            const em = mockEntityManager({ query: [SAVE_SCHEDULE, rows] })
            const { service } = await build(em)

            await expect(service.proposeWeek("user-1", "ws-1", { week: "2026-10-12" })).rejects.toMatchObject({
                code: ShiftsErrorCode.ScheduleNotSaved,
            })

            expect(em.query.mock.calls).toHaveLength(1)
        },
    )

    const fallbackExplanation = text("shifts.explain.fallback", {
        week: "week:2026-10-12",
        version: 3,
        shifts: 1,
        open: 1,
        cost: "0\u0111",
        short: text("shifts.explain.shortSome", { count: 1 }),
    })

    it.each<[boolean, string, boolean, string]>([
        [true, "  Everyone is scheduled.\n", false, "Everyone is scheduled."],
        [false, "Ignore this failed result", true, fallbackExplanation],
        [true, " \n ", true, fallbackExplanation],
    ])("explainSchedule stores generated or fallback text: %s %s", async (ok, output, fallback, explanation) => {
        const em = mockEntityManager({ query: [SET_EXPLANATION, []] })
        const { service, generator, data } = await build(em)
        generator.generate.mockResolvedValue({ ok, output })
        if (fallback) {
            data.scheduleRow.mockResolvedValue(scheduleOf({ cost_vnd: "invalid" }))
            data.scheduleShifts.mockResolvedValue([shiftOf(), shiftOf({ id: "open-1", staffId: null })])
            data.loadSetup.mockResolvedValue(setupOf({ blocks: [blockOf({ min: 2, ideal: 2 })] }))
        }
        await expect(service.explainSchedule("user-1", "ws-1", { scheduleId: "schedule-1" })).resolves.toEqual({
            explanation,
        })
        expect(data.scheduleShifts.mock.calls).toEqual([["ws-1", "schedule-1"]])
        expect(data.loadSetup.mock.calls).toEqual([["ws-1", false]])
        expect(em.query.mock.calls).toEqual([
            [SET_EXPLANATION, ["ws-1", "schedule-1", explanation, JSON.stringify({ source: "saved" })]],
        ])
    })

    it.each([
        { waiting: true, costVnd: "60000.4", attempts: 1, shifts: 2, open: 1, cost: "60.000\u0111" },
        { waiting: false, costVnd: "invalid", attempts: 0, shifts: 1, open: 0, cost: "0\u0111" },
    ])("requestPublish: requests publication with waiting=$waiting and cost=$costVnd", async (scenario) => {
        const { waiting, costVnd, attempts, shifts, open, cost } = scenario
        const em = mockEntityManager({ query: [LINK_SCHEDULE, []] })
        const { service, data, gate, members } = await build(em)
        data.scheduleRow.mockResolvedValue(scheduleOf({ cost_vnd: costVnd }))
        data.scheduleShifts.mockResolvedValue(
            waiting ? [shiftOf(), shiftOf({ id: "open-1", staffId: null })] : [shiftOf()],
        )
        data.askAttempts.mockResolvedValue(attempts)
        const status = waiting ? "waiting_decision" : "done"
        gate.request.mockResolvedValue({ status, workItemId: "work-1" })

        await expect(service.requestPublish("user-1", "ws-1", { scheduleId: "schedule-1" })).resolves.toEqual({
            status,
        })
        expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
        expect(data.askAttempts.mock.calls).toEqual([["ws-1", "publish_schedule", "publish_schedule:schedule-1:"]])
        expect(gate.request.mock.calls).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    actor: "Alex",
                    action: "publish_schedule",
                    subjectType: "shift_schedule",
                    subjectId: "schedule-1",
                    dedupeKey: waiting ? "publish_schedule:schedule-1:2" : "publish_schedule:schedule-1:1",
                    summary: text("shifts.publishAskSummary", {
                        week: "week:2026-10-12",
                        version: 3,
                        shifts,
                        open,
                        cost,
                    }),
                    fields: { schedule_id: "schedule-1", week_start: "2026-10-12" },
                },
            ],
        ])
        expect(em.query.mock.calls).toEqual(waiting ? [[LINK_SCHEDULE, ["ws-1", "schedule-1", "work-1"]]] : [])
    })

    it.each(["staff-1", null])("reassignShift: assigns or opens a draft shift for %s", async (staffId) => {
        const em = mockEntityManager({ query: [REASSIGN_SHIFT, []] })
        const { service, data } = await buildEdits(em)
        await expect(service.reassignShift("user-1", "ws-1", { shiftId: "shift-1", staffId })).resolves.toEqual({
            warnings: [],
        })
        expect(data.shiftRow.mock.calls).toEqual([["ws-1", "shift-1"]])
        expect(data.loadSetup.mock.calls).toEqual(staffId === null ? [] : [["ws-1", false]])
        expect(em.query.mock.calls).toEqual([[REASSIGN_SHIFT, ["ws-1", "shift-1", staffId]]])
    })

    it.each([
        { row: undefined, shiftId: "missing", code: ShiftsErrorCode.ShiftNotFound },
        {
            row: shiftRowOf({ schedule_status: "published" }),
            shiftId: "shift-1",
            code: ShiftsErrorCode.ShiftNotEditable,
        },
    ])("reassignShift: refuses an uneditable shift with $code", async ({ row, shiftId, code }) => {
        const { service, data } = await buildEdits(mockEntityManager({}))
        data.shiftRow.mockResolvedValue(row)
        await expect(service.reassignShift("user-1", "ws-1", { shiftId, staffId: null })).rejects.toMatchObject({
            code,
        })
    })

    it.each(["missing", "inactive-1"])("reassignShift: refuses unavailable staff profile %s", async (staffId) => {
        const em = mockEntityManager({})
        const { service } = await buildEdits(em)

        await expect(service.reassignShift("user-1", "ws-1", { shiftId: "shift-1", staffId })).rejects.toMatchObject({
            code: ShiftsErrorCode.StaffNotFound,
        })

        expect(em.query).not.toHaveBeenCalled()
    })

    it("reassignShift: keeps the assignment and returns the rule the person breaks", async () => {
        const em = mockEntityManager({ query: [REASSIGN_SHIFT, []] })
        const { service, data, words } = await buildEdits(em)
        data.loadEnv.mockResolvedValue(envOf())
        data.scheduleShifts.mockResolvedValue([shiftOf({ positionId: "other" })])
        words.findings.mockImplementation((list: ReadonlyArray<{ code: string }>) => list.map((item) => item.code))

        await expect(
            service.reassignShift("user-1", "ws-1", { shiftId: "shift-1", staffId: "staff-1" }),
        ).resolves.toEqual({ warnings: ["position"] })
    })

    it.each(["staff-1", null])("addDraftShift: inserts a manual draft shift for staff %s", async (staffId) => {
        const em = mockEntityManager({ query: [ADD_SHIFTS, []] })
        const { service, members } = await buildEdits(em)

        await service.addDraftShift("user-1", "ws-1", { ...addRequest, staffId })

        expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
        expect(em.query.mock.calls).toEqual([
            [
                ADD_SHIFTS,
                ["ws-1", "schedule-1", ["2026-10-12"], ["08:00"], ["10:00"], ["position-1"], [staffId], "manual"],
            ],
        ])
    })

    it.each([{ date: "2026-02-30" }, { start: "bad" }, { end: "24:00" }, { end: "08:00" }, { end: "07:00" }])(
        "addDraftShift: refuses an invalid shift date or time %j",
        async (overrides) => {
            const em = mockEntityManager({})
            const { service } = await buildEdits(em)

            await expect(
                service.addDraftShift("user-1", "ws-1", { ...addRequest, ...overrides }),
            ).rejects.toMatchObject({
                code: ShiftsErrorCode.TimeInvalid,
            })

            expect(em.query).not.toHaveBeenCalled()
        },
    )

    it("removeDraftShift checks membership and its schedule before removal", async () => {
        const em = mockEntityManager({ query: [REMOVE_SHIFT, []] })
        const { service, members, data } = await buildEdits(em)

        await service.removeDraftShift("user-1", "ws-1", { shiftId: "shift-1" })

        expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
        expect(data.shiftRow.mock.calls).toEqual([["ws-1", "shift-1"]])
        expect(em.query.mock.calls).toEqual([[REMOVE_SHIFT, ["ws-1", "shift-1"]]])
    })

    it.each<["explainSchedule" | "requestPublish" | "addDraftShift", boolean]>([
        ["explainSchedule", false],
        ["requestPublish", false],
        ["addDraftShift", false],
        ["requestPublish", true],
        ["addDraftShift", true],
    ])("refuses unusable schedules in %s (published=%s)", async (method, published) => {
        const { service, data, generator, gate } = await buildEdits(mockEntityManager({}))
        data.scheduleRow.mockResolvedValue(published ? scheduleOf({ status: "published" }) : undefined)
        await expect(
            service[method]("user-1", "ws-1", {
                ...addRequest,
                scheduleId: published ? "schedule-1" : "missing",
            }),
        ).rejects.toMatchObject({
            code: published ? ShiftsErrorCode.ScheduleNotDraft : ShiftsErrorCode.ScheduleNotFound,
        })
        expect(generator.generate).not.toHaveBeenCalled()
        expect(gate.request).not.toHaveBeenCalled()
    })
})
