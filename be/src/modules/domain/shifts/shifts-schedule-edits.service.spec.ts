import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ApprovalGate, TextGenerator } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ShiftsErrorCode } from "./errors/shifts.error"
import type { ShiftsScheduleRow, ShiftsShiftRow } from "./persistence/shifts.rows"
import { ADD_SHIFTS, REASSIGN_SHIFT, REMOVE_SHIFT } from "./persistence/shifts.sql"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsScheduleService } from "./shifts-schedule.service"
import { ShiftsTextService } from "./shifts-text.service"
import type { Env, Setup, Shift, ShiftStaff } from "./shifts.contracts"

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

const setupOf = (): Setup => ({
    positions: [],
    staff: [staffOf({ id: "inactive-1", active: false }), staffOf()],
    blocks: [],
    settings: {
        openingHours: [],
        swapNoticeHours: 12,
        leaveNoticeDays: 3,
        remindMinutes: 60,
        noshowMinutes: 15,
        overtimeHoursWeek: 40,
    },
})

const scheduleOf = (overrides: Partial<ShiftsScheduleRow> = {}): ShiftsScheduleRow => ({
    id: "schedule-1",
    week_start: "2026-10-12",
    version: 3,
    status: "draft",
    cost_vnd: "60000.4",
    summary: {},
    evidence: {},
    ...overrides,
})

const shiftRowOf = (overrides: Partial<ShiftsShiftRow> = {}): ShiftsShiftRow => ({
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
    ...overrides,
})

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
    data.scheduleRow.mockResolvedValue(scheduleOf())
    data.shiftRow.mockResolvedValue(shiftRowOf())
    data.scheduleShifts.mockResolvedValue([])
    data.loadEnv.mockResolvedValue({
        staff: new Map(),
        avail: [],
        leaves: [],
        overtimeHoursWeek: 40,
    })
    const words = mock<ShiftsTextService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsScheduleService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T08:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ShiftsDataService, useValue: data },
            { provide: ShiftsTextService, useValue: words },
            { provide: TextGenerator, useValue: mock<TextGenerator>() },
            { provide: ApprovalGate, useValue: mock<ApprovalGate>() },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsScheduleService), members, data, words }
}

const addRequest = {
    scheduleId: "schedule-1",
    date: "2026-10-12",
    start: "08:00",
    end: "10:00",
    positionId: "position-1",
    staffId: "staff-1",
}

describe("ShiftsScheduleService draft edits", () => {
    describe("reassignShift", () => {
        it("gives a draft shift to an active staff member", async () => {
            const em = mockEntityManager({ query: [REASSIGN_SHIFT, []] })
            const { service, data } = await build(em)

            await expect(
                service.reassignShift("user-1", "ws-1", { shiftId: "shift-1", staffId: "staff-1" }),
            ).resolves.toEqual({ warnings: [] })

            expect(data.shiftRow.mock.calls).toEqual([["ws-1", "shift-1"]])
            expect(data.loadSetup.mock.calls).toEqual([["ws-1", false]])
            expect(em.query.mock.calls).toEqual([[REASSIGN_SHIFT, ["ws-1", "shift-1", "staff-1"]]])
        })

        it("opens a draft shift without reading staff", async () => {
            const em = mockEntityManager({ query: [REASSIGN_SHIFT, []] })
            const { service, data } = await build(em)

            await expect(
                service.reassignShift("user-1", "ws-1", { shiftId: "shift-1", staffId: null }),
            ).resolves.toEqual({ warnings: [] })

            expect(data.loadSetup).not.toHaveBeenCalled()
            expect(em.query.mock.calls).toEqual([[REASSIGN_SHIFT, ["ws-1", "shift-1", null]]])
        })

        it("refuses a missing shift", async () => {
            const { service, data } = await build(mockEntityManager())
            data.shiftRow.mockResolvedValue(undefined)

            await expect(
                service.reassignShift("user-1", "ws-1", { shiftId: "missing", staffId: null }),
            ).rejects.toMatchObject({
                code: ShiftsErrorCode.ShiftNotFound,
            })
        })

        it("refuses a shift outside a draft schedule", async () => {
            const { service, data } = await build(mockEntityManager())
            data.shiftRow.mockResolvedValue(shiftRowOf({ schedule_status: "published" }))

            await expect(
                service.reassignShift("user-1", "ws-1", { shiftId: "shift-1", staffId: null }),
            ).rejects.toMatchObject({
                code: ShiftsErrorCode.ShiftNotEditable,
            })
        })

        it.each(["missing", "inactive-1"])("refuses unavailable staff profile %s", async (staffId) => {
            const em = mockEntityManager()
            const { service } = await build(em)

            await expect(
                service.reassignShift("user-1", "ws-1", { shiftId: "shift-1", staffId }),
            ).rejects.toMatchObject({
                code: ShiftsErrorCode.StaffNotFound,
            })

            expect(em.query).not.toHaveBeenCalled()
        })

        it("keeps the assignment and returns the rule the person breaks", async () => {
            const em = mockEntityManager({ query: [REASSIGN_SHIFT, []] })
            const { service, data, words } = await build(em)
            const placed: Shift = {
                id: "shift-1",
                date: "2026-10-12",
                start: "08:00",
                end: "10:00",
                positionId: "other",
                staffId: "staff-1",
                status: "draft",
            }
            const env: Env = {
                staff: new Map([["staff-1", staffOf()]]),
                avail: [],
                leaves: [],
                overtimeHoursWeek: 40,
            }
            data.loadEnv.mockResolvedValue(env)
            data.scheduleShifts.mockResolvedValue([placed])
            words.findings.mockImplementation((list: ReadonlyArray<{ code: string }>) => list.map((item) => item.code))

            await expect(
                service.reassignShift("user-1", "ws-1", { shiftId: "shift-1", staffId: "staff-1" }),
            ).resolves.toEqual({ warnings: ["position"] })
        })
    })

    describe("addDraftShift", () => {
        it.each(["staff-1", null])("inserts a manual draft shift for staff %s", async (staffId) => {
            const em = mockEntityManager({ query: [ADD_SHIFTS, []] })
            const { service, members } = await build(em)

            await service.addDraftShift("user-1", "ws-1", { ...addRequest, staffId })

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
            expect(em.query.mock.calls).toEqual([
                [
                    ADD_SHIFTS,
                    ["ws-1", "schedule-1", ["2026-10-12"], ["08:00"], ["10:00"], ["position-1"], [staffId], "manual"],
                ],
            ])
        })

        it("refuses a missing schedule", async () => {
            const { service, data } = await build(mockEntityManager())
            data.scheduleRow.mockResolvedValue(undefined)

            await expect(service.addDraftShift("user-1", "ws-1", addRequest)).rejects.toMatchObject({
                code: ShiftsErrorCode.ScheduleNotFound,
            })
        })

        it("refuses a published schedule", async () => {
            const { service, data } = await build(mockEntityManager())
            data.scheduleRow.mockResolvedValue(scheduleOf({ status: "published" }))

            await expect(service.addDraftShift("user-1", "ws-1", addRequest)).rejects.toMatchObject({
                code: ShiftsErrorCode.ScheduleNotDraft,
            })
        })

        it.each([{ date: "2026-02-30" }, { start: "bad" }, { end: "24:00" }, { end: "08:00" }, { end: "07:00" }])(
            "refuses an invalid shift date or time %j",
            async (overrides) => {
                const em = mockEntityManager()
                const { service } = await build(em)

                await expect(
                    service.addDraftShift("user-1", "ws-1", { ...addRequest, ...overrides }),
                ).rejects.toMatchObject({
                    code: ShiftsErrorCode.TimeInvalid,
                })

                expect(em.query).not.toHaveBeenCalled()
            },
        )
    })

    describe("removeDraftShift", () => {
        it("removes a draft shift after checking membership and its schedule", async () => {
            const em = mockEntityManager({ query: [REMOVE_SHIFT, []] })
            const { service, members, data } = await build(em)

            await service.removeDraftShift("user-1", "ws-1", { shiftId: "shift-1" })

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
            expect(data.shiftRow.mock.calls).toEqual([["ws-1", "shift-1"]])
            expect(em.query.mock.calls).toEqual([[REMOVE_SHIFT, ["ws-1", "shift-1"]]])
        })
    })
})
