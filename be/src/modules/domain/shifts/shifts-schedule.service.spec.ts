import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ApprovalGate, TextGenerator } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ShiftsErrorCode } from "./errors/shifts.error"
import type { ShiftsScheduleRow } from "./persistence/shifts.rows"
import { ADD_SHIFTS, LINK_SCHEDULE, SAVE_SCHEDULE, SET_EXPLANATION } from "./persistence/shifts.sql"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsScheduleService } from "./shifts-schedule.service"
import { ShiftsTextService } from "./shifts-text.service"
import type { Block, Env, Setup, Shift, ShiftStaff } from "./shifts.contracts"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const staffOf = (overrides: Partial<ShiftStaff> = {}): ShiftStaff => ({
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
    ...overrides,
})

const blockOf = (overrides: Partial<Block> = {}): Block => ({
    id: "block-1",
    weekday: 0,
    start: "08:00",
    end: "10:00",
    positionId: "position-1",
    min: 1,
    ideal: 1,
    peak: false,
    ...overrides,
})

const setupOf = (overrides: Partial<Setup> = {}): Setup => ({
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
    ...overrides,
})

const envOf = (overrides: Partial<Env> = {}): Env => ({
    staff: new Map([["staff-1", staffOf()]]),
    avail: [],
    leaves: [],
    overtimeHoursWeek: 40,
    ...overrides,
})

const scheduleOf = (overrides: Partial<ShiftsScheduleRow> = {}): ShiftsScheduleRow => ({
    id: "schedule-1",
    week_start: "2026-10-12",
    version: 3,
    status: "draft",
    cost_vnd: "60000.4",
    summary: {},
    evidence: { source: "saved" },
    ...overrides,
})

const shiftOf = (overrides: Partial<Shift> = {}): Shift => ({
    id: "shift-1",
    date: "2026-10-12",
    start: "08:00",
    end: "10:00",
    positionId: "position-1",
    staffId: "staff-1",
    status: "draft",
    ...overrides,
})

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
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
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    words.week.mockImplementation((monday) => `week:${monday}`)
    const generator = mock<TextGenerator>()
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
            { provide: TextGenerator, useValue: generator },
            { provide: ApprovalGate, useValue: gate },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsScheduleService), members, data, words, generator, gate, catalog }
}

describe("ShiftsScheduleService", () => {
    describe("proposeWeek", () => {
        it("solves and saves the containing week with exact shifts and evidence", async () => {
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

            await expect(service.proposeWeek("user-1", "ws-1", { week: "2026-10-15" })).resolves.toEqual({
                scheduleId: "schedule-1",
                version: 3,
                shifts: 1,
                open: 0,
                short: 0,
                costVnd: 60000,
                ms: 0,
                iterations: 6,
            })

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
            expect(data.loadSetup.mock.calls).toEqual([["ws-1", true]])
            expect(data.loadEnv.mock.calls).toEqual([["ws-1", "2026-10-12", setupOf()]])
            expect(em.query.mock.calls).toEqual([
                [
                    SAVE_SCHEDULE,
                    [
                        "ws-1",
                        "2026-10-12",
                        60000,
                        JSON.stringify({
                            coverage: [
                                {
                                    blockId: "block-1",
                                    date: "2026-10-12",
                                    positionId: "position-1",
                                    start: "08:00",
                                    end: "10:00",
                                    min: 1,
                                    ideal: 1,
                                    peak: false,
                                    have: 1,
                                    status: "ok",
                                },
                            ],
                            hours: [{ staffId: "staff-1", hours: 2 }],
                        }),
                        JSON.stringify({
                            solver: {
                                ms: 0,
                                iterations: 6,
                                costVnd: 60000,
                                shiftCount: 1,
                                openCount: 0,
                                shortages: [],
                                hoursByStaff: [{ staffId: "staff-1", hours: 2 }],
                                askCandidates: [],
                            },
                        }),
                        0,
                        "Alex",
                    ],
                ],
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

        it("saves an empty solution with the default version and evidence without inserting shifts", async () => {
            const em = mockEntityManager({
                query: [
                    [SAVE_SCHEDULE, [{ id: "schedule-1" }]],
                    [SET_EXPLANATION, []],
                ],
            })
            const { service, data } = await build(em)
            data.loadSetup.mockResolvedValue(setupOf({ blocks: [blockOf({ min: 0, ideal: 0 })] }))
            data.scheduleRow.mockResolvedValue(undefined)

            await expect(service.proposeWeek("user-1", "ws-1", { week: "2026-10-12" })).resolves.toEqual({
                scheduleId: "schedule-1",
                version: 1,
                shifts: 0,
                open: 0,
                short: 0,
                costVnd: 0,
                ms: 0,
                iterations: 6,
            })

            expect(em.query.mock.calls).toHaveLength(2)
            expect(em.query.mock.calls[1]).toEqual([
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
            ])
        })

        it("counts shortages and inserts open shifts alongside assigned shifts", async () => {
            const em = mockEntityManager({
                query: [
                    [SAVE_SCHEDULE, [{ id: "schedule-1" }]],
                    [ADD_SHIFTS, []],
                    [SET_EXPLANATION, []],
                ],
            })
            const { service, data } = await build(em)
            data.loadSetup.mockResolvedValue(setupOf({ blocks: [blockOf({ min: 2, ideal: 2 })] }))

            await expect(service.proposeWeek("user-1", "ws-1", { week: "2026-10-12" })).resolves.toEqual({
                scheduleId: "schedule-1",
                version: 3,
                shifts: 1,
                open: 1,
                short: 1,
                costVnd: 60000,
                ms: 0,
                iterations: 6,
            })

            expect(em.query.mock.calls[1]).toEqual([
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
            ])
        })

        it("refuses an invalid week before reading setup", async () => {
            const em = mockEntityManager()
            const { service, data } = await build(em)

            await expect(service.proposeWeek("user-1", "ws-1", { week: "2026-02-30" })).rejects.toMatchObject({
                code: ShiftsErrorCode.WeekInvalid,
            })

            expect(data.loadSetup).not.toHaveBeenCalled()
            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses a setup without active staff", async () => {
            const { service, data } = await build(mockEntityManager())
            data.loadSetup.mockResolvedValue(setupOf({ staff: [staffOf({ active: false })] }))

            await expect(service.proposeWeek("user-1", "ws-1", { week: "2026-10-12" })).rejects.toMatchObject({
                code: ShiftsErrorCode.NoStaff,
            })
        })

        it("refuses a setup without coverage", async () => {
            const { service, data } = await build(mockEntityManager())
            data.loadSetup.mockResolvedValue(setupOf({ blocks: [] }))

            await expect(service.proposeWeek("user-1", "ws-1", { week: "2026-10-12" })).rejects.toMatchObject({
                code: ShiftsErrorCode.NoCoverage,
            })
        })

        it.each([{ rows: [] }, { rows: [{ id: null }] }])("refuses a save without an id from %j", async ({ rows }) => {
            const em = mockEntityManager({ query: [SAVE_SCHEDULE, rows] })
            const { service } = await build(em)

            await expect(service.proposeWeek("user-1", "ws-1", { week: "2026-10-12" })).rejects.toMatchObject({
                code: ShiftsErrorCode.ScheduleNotSaved,
            })

            expect(em.query.mock.calls).toHaveLength(1)
        })
    })

    describe("explainSchedule", () => {
        it("stores a trimmed generated explanation with the existing evidence", async () => {
            const em = mockEntityManager({ query: [SET_EXPLANATION, []] })
            const { service, generator, data } = await build(em)
            generator.generate.mockResolvedValue({ ok: true, output: "  Everyone is scheduled.\n" })

            await expect(service.explainSchedule("user-1", "ws-1", { scheduleId: "schedule-1" })).resolves.toEqual({
                explanation: "Everyone is scheduled.",
            })

            expect(data.scheduleShifts.mock.calls).toEqual([["ws-1", "schedule-1"]])
            expect(data.loadSetup.mock.calls).toEqual([["ws-1", false]])
            expect(em.query.mock.calls).toEqual([
                [
                    SET_EXPLANATION,
                    ["ws-1", "schedule-1", "Everyone is scheduled.", JSON.stringify({ source: "saved" })],
                ],
            ])
        })

        it.each([
            { ok: false, output: "Ignore this failed result" },
            { ok: true, output: " \n " },
        ])("uses exact fallback facts for an unusable generator result %j", async (written) => {
            const em = mockEntityManager({ query: [SET_EXPLANATION, []] })
            const { service, generator, data } = await build(em)
            generator.generate.mockResolvedValue(written)
            data.scheduleRow.mockResolvedValue(scheduleOf({ cost_vnd: "invalid" }))
            data.scheduleShifts.mockResolvedValue([shiftOf(), shiftOf({ id: "open-1", staffId: null })])
            data.loadSetup.mockResolvedValue(setupOf({ blocks: [blockOf({ min: 2, ideal: 2 })] }))
            const explanation = text("shifts.explain.fallback", {
                week: "week:2026-10-12",
                version: 3,
                shifts: 1,
                open: 1,
                cost: "0\u0111",
                short: text("shifts.explain.shortSome", { count: 1 }),
            })

            await expect(service.explainSchedule("user-1", "ws-1", { scheduleId: "schedule-1" })).resolves.toEqual({
                explanation,
            })

            expect(em.query.mock.calls).toEqual([
                [SET_EXPLANATION, ["ws-1", "schedule-1", explanation, JSON.stringify({ source: "saved" })]],
            ])
        })

        it("refuses a missing schedule", async () => {
            const { service, data, generator } = await build(mockEntityManager())
            data.scheduleRow.mockResolvedValue(undefined)

            await expect(service.explainSchedule("user-1", "ws-1", { scheduleId: "missing" })).rejects.toMatchObject({
                code: ShiftsErrorCode.ScheduleNotFound,
            })

            expect(generator.generate).not.toHaveBeenCalled()
        })
    })

    describe("requestPublish", () => {
        it("asks the owner and links a waiting decision to its draft schedule", async () => {
            const em = mockEntityManager({ query: [LINK_SCHEDULE, []] })
            const { service, data, gate, members } = await build(em)
            data.scheduleShifts.mockResolvedValue([shiftOf(), shiftOf({ id: "open-1", staffId: null })])
            gate.request.mockResolvedValue({ status: "waiting_decision", workItemId: "work-1" })

            await expect(service.requestPublish("user-1", "ws-1", { scheduleId: "schedule-1" })).resolves.toEqual({
                status: "waiting_decision",
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
                        dedupeKey: "publish_schedule:schedule-1:2",
                        summary: text("shifts.publishAskSummary", {
                            week: "week:2026-10-12",
                            version: 3,
                            shifts: 2,
                            open: 1,
                            cost: "60.000\u0111",
                        }),
                        fields: { schedule_id: "schedule-1", week_start: "2026-10-12" },
                    },
                ],
            ])
            expect(em.query.mock.calls).toEqual([[LINK_SCHEDULE, ["ws-1", "schedule-1", "work-1"]]])
        })

        it("returns an immediate verdict without linking and treats an invalid cost as zero", async () => {
            const em = mockEntityManager()
            const { service, data, gate } = await build(em)
            data.scheduleRow.mockResolvedValue(scheduleOf({ cost_vnd: "invalid" }))
            data.askAttempts.mockResolvedValue(0)

            await expect(service.requestPublish("user-1", "ws-1", { scheduleId: "schedule-1" })).resolves.toEqual({
                status: "done",
            })

            expect(gate.request.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        actor: "Alex",
                        action: "publish_schedule",
                        subjectType: "shift_schedule",
                        subjectId: "schedule-1",
                        dedupeKey: "publish_schedule:schedule-1:1",
                        summary: text("shifts.publishAskSummary", {
                            week: "week:2026-10-12",
                            version: 3,
                            shifts: 1,
                            open: 0,
                            cost: "0\u0111",
                        }),
                        fields: { schedule_id: "schedule-1", week_start: "2026-10-12" },
                    },
                ],
            ])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses a missing schedule", async () => {
            const { service, data, gate } = await build(mockEntityManager())
            data.scheduleRow.mockResolvedValue(undefined)

            await expect(service.requestPublish("user-1", "ws-1", { scheduleId: "missing" })).rejects.toMatchObject({
                code: ShiftsErrorCode.ScheduleNotFound,
            })

            expect(gate.request).not.toHaveBeenCalled()
        })

        it("refuses a published schedule", async () => {
            const { service, data, gate } = await build(mockEntityManager())
            data.scheduleRow.mockResolvedValue(scheduleOf({ status: "published" }))

            await expect(service.requestPublish("user-1", "ws-1", { scheduleId: "schedule-1" })).rejects.toMatchObject({
                code: ShiftsErrorCode.ScheduleNotDraft,
            })

            expect(gate.request).not.toHaveBeenCalled()
        })
    })
})
