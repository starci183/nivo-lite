import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ShiftsShiftRow, ShiftsStaffRow } from "./persistence/shifts.rows"
import {
    COUNT_WORK_ASKS,
    SELECT_APPROVED_LEAVES,
    SELECT_AVAILABILITY,
    SELECT_COVERAGE,
    SELECT_LEAVE,
    SELECT_PAY,
    SELECT_POSITIONS,
    SELECT_PRIOR_SHIFTS,
    SELECT_RANGE_SHIFTS,
    SELECT_SCHEDULE,
    SELECT_SCHEDULE_SHIFTS,
    SELECT_SETTINGS,
    SELECT_SHIFT,
    SELECT_STAFF,
    SELECT_STAFF_SHIFTS,
    SELECT_SWAP,
    SELECT_PROFILE_OF_USER,
} from "./persistence/shifts.sql"
import type { Setup, Shift, ShiftStaff } from "./shifts.contracts"
import { ShiftsDataService } from "./shifts-data.service"

const staffRow = (overrides: Partial<ShiftsStaffRow> = {}): ShiftsStaffRow => ({
    id: "staff-1",
    name: "Alex",
    staff_id: "member-1",
    phone: "123456789",
    telegram_chat_id: "telegram-1",
    zalo_user_id: "zalo-1",
    position_ids: ["position-1"],
    skills: ["coffee"],
    max_hours_week: "40",
    max_hours_day: "8",
    min_rest_hours: "12",
    active: true,
    ...overrides,
})

const person: ShiftStaff = {
    id: "staff-1",
    name: "Alex",
    staffRowId: "member-1",
    phone: "123456789",
    telegramChatId: "telegram-1",
    zaloUserId: "zalo-1",
    positionIds: ["position-1"],
    skills: ["coffee"],
    maxWeek: 40,
    maxDay: 8,
    minRest: 12,
    wage: 30000,
    active: true,
}

const settings = {
    openingHours: [{ weekday: 0, open: "08:00", close: "22:00" }],
    swapNoticeHours: 12,
    leaveNoticeDays: 3,
    remindMinutes: 45,
    noshowMinutes: 15,
    overtimeHoursWeek: 40,
}

const shiftRow = (overrides: Partial<ShiftsShiftRow> = {}): ShiftsShiftRow => ({
    id: "shift-1",
    schedule_id: "schedule-1",
    shift_date: "2026-10-12",
    start_time: "08:00:00",
    end_time: "16:00:00",
    position_id: "position-1",
    staff_id: "staff-1",
    status: "published",
    schedule_status: "published",
    week_start: "2026-10-12",
    ...overrides,
})

const shift: Shift = {
    id: "shift-1",
    date: "2026-10-12",
    start: "08:00",
    end: "16:00",
    positionId: "position-1",
    staffId: "staff-1",
    status: "published",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ShiftsDataService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ShiftsDataService)
}

const setupRows: ReadonlyArray<readonly [string, ReadonlyArray<object>]> = [
    [SELECT_POSITIONS, [{ id: "position-1", name: "Barista", color: "#123456" }]],
    [
        SELECT_STAFF,
        [staffRow(), staffRow({ id: "staff-2", name: "Blair" }), staffRow({ id: "staff-3", name: "Casey" })],
    ],
    [
        SELECT_PAY,
        [
            { staff_id: "staff-1", hourly_wage_vnd: "30000.00" },
            { staff_id: "staff-2", hourly_wage_vnd: "unreadable" },
        ],
    ],
    [
        SELECT_COVERAGE,
        [
            {
                id: "block-1",
                weekday: 0,
                start_time: "08:00:00",
                end_time: "16:00:00",
                position_id: "position-1",
                min_staff: 1,
                ideal_staff: 2,
                is_peak: true,
            },
        ],
    ],
    [
        SELECT_SETTINGS,
        [
            {
                opening_hours: { "0": { open: "08:00", close: "22:00" } },
                swap_notice_hours: 12,
                leave_notice_days: 3,
                remind_minutes: 45,
                noshow_minutes: 15,
                overtime_hours_week: "40",
            },
        ],
    ],
]

describe("ShiftsDataService loadSetup", () => {
    it("maps positions, people, wages, coverage and settings exactly", async () => {
        const em = mockEntityManager({ query: setupRows })
        const service = await build(em)

        await expect(service.loadSetup("ws-1", true)).resolves.toEqual({
            positions: [{ id: "position-1", name: "Barista", color: "#123456" }],
            staff: [
                person,
                { ...person, id: "staff-2", name: "Blair", wage: 0 },
                { ...person, id: "staff-3", name: "Casey", wage: 0 },
            ],
            blocks: [
                {
                    id: "block-1",
                    weekday: 0,
                    start: "08:00",
                    end: "16:00",
                    positionId: "position-1",
                    min: 1,
                    ideal: 2,
                    peak: true,
                },
            ],
            settings,
        })
        expect(em.query.mock.calls).toEqual([
            [SELECT_POSITIONS, ["ws-1"]],
            [SELECT_STAFF, ["ws-1"]],
            [SELECT_PAY, ["ws-1"]],
            [SELECT_COVERAGE, ["ws-1"]],
            [SELECT_SETTINGS, ["ws-1"]],
        ])
    })
})

describe("ShiftsDataService loadSetup", () => {
    it("omits the pay query and uses zero wages and default rules when settings are absent", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_POSITIONS, []],
                [SELECT_STAFF, [staffRow()]],
                [SELECT_COVERAGE, []],
                [SELECT_SETTINGS, []],
            ],
        })
        const service = await build(em)

        await expect(service.loadSetup("ws-1", false)).resolves.toEqual({
            positions: [],
            staff: [{ ...person, wage: 0 }],
            blocks: [],
            settings: {
                openingHours: [],
                swapNoticeHours: 24,
                leaveNoticeDays: 2,
                remindMinutes: 60,
                noshowMinutes: 10,
                overtimeHoursWeek: 48,
            },
        })
        expect(em.query.mock.calls).toEqual([
            [SELECT_POSITIONS, ["ws-1"]],
            [SELECT_STAFF, ["ws-1"]],
            [SELECT_COVERAGE, ["ws-1"]],
            [SELECT_SETTINGS, ["ws-1"]],
        ])
    })
})

describe("ShiftsDataService", () => {
    it("loads approved availability and leave for the week and prior work for the preceding day", async () => {
        const em = mockEntityManager({
            query: [
                [
                    SELECT_AVAILABILITY,
                    [
                        {
                            staff_id: "staff-1",
                            weekday: 0,
                            shift_date: null,
                            start_time: "08:00:00",
                            end_time: "16:00:00",
                            available: true,
                        },
                    ],
                ],
                [
                    SELECT_APPROVED_LEAVES,
                    [
                        {
                            id: "leave-1",
                            staff_id: "staff-1",
                            from_date: "2026-10-15",
                            to_date: "2026-10-16",
                            reason: "holiday",
                            status: "approved",
                        },
                    ],
                ],
                [
                    SELECT_PRIOR_SHIFTS,
                    [shiftRow({ shift_date: "2026-10-11", start_time: "20:00:00", end_time: "23:00:00" })],
                ],
            ],
        })
        const service = await build(em)
        const setup: Setup = { positions: [], staff: [person], blocks: [], settings }

        await expect(service.loadEnv("ws-1", "2026-10-12", setup)).resolves.toEqual({
            staff: new Map([["staff-1", person]]),
            avail: [{ staffId: "staff-1", weekday: 0, date: null, start: "08:00", end: "16:00", available: true }],
            leaves: [{ staffId: "staff-1", from: "2026-10-15", to: "2026-10-16" }],
            prior: new Map([["staff-1", [{ date: "2026-10-11", s: 1200, e: 1380, pos: "position-1" }]]]),
            overtimeHoursWeek: 40,
        })
        expect(em.query.mock.calls).toEqual([
            [SELECT_AVAILABILITY, ["ws-1"]],
            [SELECT_APPROVED_LEAVES, ["ws-1", "2026-10-12", "2026-10-18"]],
            [SELECT_PRIOR_SHIFTS, ["ws-1", "2026-10-11"]],
        ])
    })
})

describe("ShiftsDataService", () => {
    it("maps schedule, workspace-range and staff-range shifts and forwards each query parameter", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_SCHEDULE_SHIFTS, [shiftRow()]],
                [SELECT_RANGE_SHIFTS, [shiftRow()]],
                [SELECT_STAFF_SHIFTS, [shiftRow()]],
            ],
        })
        const service = await build(em)
        const statuses = ["published", "swapped"]

        await expect(service.scheduleShifts("ws-1", "schedule-1")).resolves.toEqual([shift])
        await expect(service.rangeShifts("ws-1", "2026-10-12", "2026-10-18", statuses)).resolves.toEqual([shift])
        await expect(service.staffShifts("ws-1", "staff-1", "2026-10-12", "2026-10-18", statuses)).resolves.toEqual([
            shift,
        ])
        expect(em.query.mock.calls).toEqual([
            [SELECT_SCHEDULE_SHIFTS, ["ws-1", "schedule-1"]],
            [SELECT_RANGE_SHIFTS, ["ws-1", "2026-10-12", "2026-10-18", statuses]],
            [SELECT_STAFF_SHIFTS, ["ws-1", "staff-1", "2026-10-12", "2026-10-18", statuses]],
        ])
    })

    it("returns the first raw shift, schedule, leave and swap rows", async () => {
        const schedule = {
            id: "schedule-1",
            week_start: "2026-10-12",
            version: 2,
            status: "draft",
            cost_vnd: "240000",
            summary: { shifts: 1 },
            evidence: { iterations: 1 },
        }
        const leave = {
            id: "leave-1",
            staff_id: "staff-1",
            from_date: "2026-10-15",
            to_date: "2026-10-16",
            reason: "holiday",
            status: "approved",
        }
        const swap = {
            id: "swap-1",
            kind: "swap",
            shift_id: "shift-1",
            from_staff_id: "staff-1",
            to_staff_id: "staff-2",
            status: "pending",
        }
        const em = mockEntityManager({
            query: [
                [SELECT_SHIFT, [shiftRow(), shiftRow({ id: "shift-2" })]],
                [SELECT_SCHEDULE, [schedule, { ...schedule, id: "schedule-2" }]],
                [SELECT_LEAVE, [leave, { ...leave, id: "leave-2" }]],
                [SELECT_SWAP, [swap, { ...swap, id: "swap-2" }]],
            ],
        })
        const service = await build(em)

        await expect(service.shiftRow("ws-1", "shift-1")).resolves.toEqual(shiftRow())
        await expect(service.scheduleRow("ws-1", "schedule-1")).resolves.toEqual(schedule)
        await expect(service.leaveRow("ws-1", "leave-1")).resolves.toEqual(leave)
        await expect(service.swapRow("ws-1", "swap-1")).resolves.toEqual(swap)
        expect(em.query.mock.calls).toEqual([
            [SELECT_SHIFT, ["ws-1", "shift-1"]],
            [SELECT_SCHEDULE, ["ws-1", "schedule-1"]],
            [SELECT_LEAVE, ["ws-1", "leave-1"]],
            [SELECT_SWAP, ["ws-1", "swap-1"]],
        ])
    })
})

describe("ShiftsDataService", () => {
    it("returns undefined when a shift, schedule, leave or swap does not exist", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_SHIFT, []],
                [SELECT_SCHEDULE, []],
                [SELECT_LEAVE, []],
                [SELECT_SWAP, []],
            ],
        })
        const service = await build(em)

        await expect(service.shiftRow("ws-1", "shift-1")).resolves.toBeUndefined()
        await expect(service.scheduleRow("ws-1", "schedule-1")).resolves.toBeUndefined()
        await expect(service.leaveRow("ws-1", "leave-1")).resolves.toBeUndefined()
        await expect(service.swapRow("ws-1", "swap-1")).resolves.toBeUndefined()
        expect(em.query.mock.calls).toEqual([
            [SELECT_SHIFT, ["ws-1", "shift-1"]],
            [SELECT_SCHEDULE, ["ws-1", "schedule-1"]],
            [SELECT_LEAVE, ["ws-1", "leave-1"]],
            [SELECT_SWAP, ["ws-1", "swap-1"]],
        ])
    })

    it("returns a member profile id or null for a null or missing profile", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_PROFILE_OF_USER, [{ id: "staff-1" }]],
                [SELECT_PROFILE_OF_USER, [{ id: null }]],
                [SELECT_PROFILE_OF_USER, []],
            ],
        })
        const service = await build(em)

        await expect(service.profileOf("ws-1", "user-1")).resolves.toBe("staff-1")
        await expect(service.profileOf("ws-1", "user-2")).resolves.toBeNull()
        await expect(service.profileOf("ws-1", "user-3")).resolves.toBeNull()
        expect(em.query.mock.calls).toEqual([
            [SELECT_PROFILE_OF_USER, ["ws-1", "user-1"]],
            [SELECT_PROFILE_OF_USER, ["ws-1", "user-2"]],
            [SELECT_PROFILE_OF_USER, ["ws-1", "user-3"]],
        ])
    })

    it("counts attempts using a prefix pattern and returns zero when no count row exists", async () => {
        const em = mockEntityManager({
            query: [
                [COUNT_WORK_ASKS, [{ attempts: 3 }]],
                [COUNT_WORK_ASKS, []],
            ],
        })
        const service = await build(em)

        await expect(service.askAttempts("ws-1", "publish_schedule", "publish:schedule-1:")).resolves.toBe(3)
        await expect(service.askAttempts("ws-1", "approve_swap", "swap:swap-1:")).resolves.toBe(0)
        expect(em.query.mock.calls).toEqual([
            [COUNT_WORK_ASKS, ["ws-1", "publish_schedule", "publish:schedule-1:%"]],
            [COUNT_WORK_ASKS, ["ws-1", "approve_swap", "swap:swap-1:%"]],
        ])
    })
})
