import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Between, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Not } from "typeorm"
import { WorkItemsService } from "@modules/domain/work-items"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import {
    ShiftsAvailabilityEntity,
    ShiftsCoverageEntity,
    ShiftsLeaveRequestEntity,
    ShiftsPositionEntity,
    ShiftsScheduleEntity,
    ShiftsSettingsEntity,
    ShiftsShiftEntity,
    ShiftsStaffEntity,
    ShiftsStaffPayEntity,
    ShiftsSwapRequestEntity,
} from "./persistence/entities"
import type { Setup, Shift, ShiftStaff } from "./shifts.contracts"
import { ShiftsDataService } from "./shifts-data.service"

const staffRow = (overrides: Partial<ShiftsStaffEntity> = {}): ShiftsStaffEntity =>
    Object.assign(new ShiftsStaffEntity(), {
        id: "staff-1",
        name: "Alex",
        staffId: "member-1",
        phone: "123456789",
        telegramChatId: "telegram-1",
        zaloUserId: "zalo-1",
        positionIds: ["position-1"],
        skills: ["coffee"],
        maxHoursWeek: "40",
        maxHoursDay: "8",
        minRestHours: "12",
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

const shiftRow = (overrides: Partial<ShiftsShiftEntity> = {}): ShiftsShiftEntity =>
    Object.assign(new ShiftsShiftEntity(), {
        id: "shift-1",
        scheduleId: "schedule-1",
        shiftDate: "2026-10-12",
        startTime: "08:00:00",
        endTime: "16:00:00",
        positionId: "position-1",
        staffId: "staff-1",
        status: "published",
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

const workItems = mock<WorkItemsService>()

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsDataService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkItemsService, useValue: workItems },
        ],
    }).compile()
    return moduleRef.get(ShiftsDataService)
}

const position = Object.assign(new ShiftsPositionEntity(), { id: "position-1", name: "Barista", color: "#123456" })

const coverage = Object.assign(new ShiftsCoverageEntity(), {
    id: "block-1",
    weekday: 0,
    startTime: "08:00:00",
    endTime: "16:00:00",
    positionId: "position-1",
    minStaff: 1,
    idealStaff: 2,
    isPeak: true,
})

const settingsRow = Object.assign(new ShiftsSettingsEntity(), {
    openingHours: { "0": { open: "08:00", close: "22:00" } },
    swapNoticeHours: 12,
    leaveNoticeDays: 3,
    remindMinutes: 45,
    noshowMinutes: 15,
    overtimeHoursWeek: "40",
})

const pay = [
    Object.assign(new ShiftsStaffPayEntity(), { staffId: "staff-1", hourlyWageVnd: 30000 }),
    Object.assign(new ShiftsStaffPayEntity(), { staffId: "staff-2", hourlyWageVnd: 0 }),
]

describe("ShiftsDataService loadSetup", () => {
    it("maps positions, people, wages, coverage and settings exactly", async () => {
        const em = mockEntityManager({
            find: [
                [ShiftsPositionEntity, [position]],
                [
                    ShiftsStaffEntity,
                    [
                        staffRow(),
                        staffRow({ id: "staff-2", name: "Blair" }),
                        staffRow({ id: "staff-3", name: "Casey" }),
                    ],
                ],
                [ShiftsStaffPayEntity, pay],
                [ShiftsCoverageEntity, [coverage]],
            ],
            findOne: [ShiftsSettingsEntity, settingsRow],
        })
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
        expect(em.find).toHaveBeenCalledWith(ShiftsPositionEntity, {
            select: { id: true, name: true, color: true },
            where: { workspaceId: "ws-1", active: true },
            order: { sortOrder: "ASC", createdAt: "ASC" },
            take: 200,
        })
        expect(em.find).toHaveBeenCalledWith(ShiftsStaffEntity, {
            where: { workspaceId: "ws-1" },
            order: { createdAt: "ASC" },
            take: 500,
        })
        expect(em.find).toHaveBeenCalledWith(ShiftsStaffPayEntity, {
            select: { staffId: true, hourlyWageVnd: true },
            where: { workspaceId: "ws-1" },
            take: 500,
        })
        expect(em.find).toHaveBeenCalledWith(ShiftsCoverageEntity, {
            where: { workspaceId: "ws-1" },
            order: { weekday: "ASC", startTime: "ASC" },
            take: 1000,
        })
        expect(em.findOne).toHaveBeenCalledWith(ShiftsSettingsEntity, { where: { workspaceId: "ws-1" } })
    })
})

describe("ShiftsDataService loadSetup without pay or settings", () => {
    it("omits the pay read and uses zero wages and default rules when settings are absent", async () => {
        const em = mockEntityManager({
            find: [
                [ShiftsPositionEntity, []],
                [ShiftsStaffEntity, [staffRow()]],
                [ShiftsCoverageEntity, []],
            ],
            findOne: [ShiftsSettingsEntity, null],
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
        expect(em.find).not.toHaveBeenCalledWith(ShiftsStaffPayEntity, expect.anything())
        expect(em.find).toHaveBeenCalledTimes(3)
    })
})

describe("ShiftsDataService loadEnv", () => {
    it("loads approved availability and leave for the week and prior work for the preceding day", async () => {
        const em = mockEntityManager({
            find: [
                [
                    ShiftsAvailabilityEntity,
                    [
                        Object.assign(new ShiftsAvailabilityEntity(), {
                            staffId: "staff-1",
                            weekday: 0,
                            shiftDate: null,
                            startTime: "08:00:00",
                            endTime: "16:00:00",
                            available: true,
                        }),
                    ],
                ],
                [
                    ShiftsLeaveRequestEntity,
                    [
                        Object.assign(new ShiftsLeaveRequestEntity(), {
                            staffId: "staff-1",
                            fromDate: "2026-10-15",
                            toDate: "2026-10-16",
                        }),
                    ],
                ],
                [
                    ShiftsShiftEntity,
                    [shiftRow({ shiftDate: "2026-10-11", startTime: "20:00:00", endTime: "23:00:00" })],
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
        expect(em.find).toHaveBeenCalledWith(ShiftsAvailabilityEntity, {
            where: { workspaceId: "ws-1", status: "approved" },
            take: 2000,
        })
        expect(em.find).toHaveBeenCalledWith(ShiftsLeaveRequestEntity, {
            where: {
                workspaceId: "ws-1",
                status: "approved",
                toDate: MoreThanOrEqual("2026-10-12"),
                fromDate: LessThanOrEqual("2026-10-18"),
            },
            take: 500,
        })
        expect(em.find).toHaveBeenCalledWith(ShiftsShiftEntity, {
            where: {
                workspaceId: "ws-1",
                shiftDate: "2026-10-11",
                status: In(["published", "swapped"]),
                staffId: Not(IsNull()),
            },
            take: 500,
        })
    })
})

describe("ShiftsDataService shifts", () => {
    it("maps schedule, workspace-range and staff-range shifts and forwards each read parameter", async () => {
        const em = mockEntityManager({ find: [ShiftsShiftEntity, [shiftRow()]] })
        const service = await build(em)
        const statuses = ["published", "swapped"]

        await expect(service.scheduleShifts("ws-1", "schedule-1")).resolves.toEqual([shift])
        await expect(service.rangeShifts("ws-1", "2026-10-12", "2026-10-18", statuses)).resolves.toEqual([shift])
        await expect(service.staffShifts("ws-1", "staff-1", "2026-10-12", "2026-10-18", statuses)).resolves.toEqual([
            shift,
        ])
        expect(em.find).toHaveBeenNthCalledWith(1, ShiftsShiftEntity, {
            where: { workspaceId: "ws-1", scheduleId: "schedule-1", status: Not("cancelled") },
            order: { shiftDate: "ASC", startTime: "ASC" },
            take: 1000,
        })
        expect(em.find).toHaveBeenNthCalledWith(2, ShiftsShiftEntity, {
            where: {
                workspaceId: "ws-1",
                shiftDate: Between("2026-10-12", "2026-10-18"),
                status: In(statuses),
                staffId: Not(IsNull()),
            },
            take: 2000,
        })
        expect(em.find).toHaveBeenNthCalledWith(3, ShiftsShiftEntity, {
            where: {
                workspaceId: "ws-1",
                staffId: "staff-1",
                shiftDate: Between("2026-10-12", "2026-10-18"),
                status: In(statuses),
            },
            take: 500,
        })
    })

    it("returns the shift with its schedule, and the schedule, leave and swap rows", async () => {
        const schedule = Object.assign(new ShiftsScheduleEntity(), {
            id: "schedule-1",
            weekStart: "2026-10-12",
            costVnd: "240000",
        })
        const leave = Object.assign(new ShiftsLeaveRequestEntity(), { id: "leave-1", staffId: "staff-1" })
        const swap = Object.assign(new ShiftsSwapRequestEntity(), { id: "swap-1", toStaffId: "staff-2" })
        const withSchedule = {
            ...shift,
            scheduleId: "schedule-1",
            scheduleStatus: "published",
            weekStart: "2026-10-12",
        }
        const em = mockEntityManager({
            findOne: [
                [ShiftsScheduleEntity, schedule],
                [ShiftsLeaveRequestEntity, leave],
                [ShiftsSwapRequestEntity, swap],
            ],
        })
        const read = fakeQueryBuilder({ getRawOne: withSchedule })
        em.createQueryBuilder.mockReturnValue(read.builder as never)
        const service = await build(em)

        await expect(service.shiftRow("ws-1", "shift-1")).resolves.toEqual(withSchedule)
        await expect(service.scheduleRow("ws-1", "schedule-1")).resolves.toBe(schedule)
        await expect(service.leaveRow("ws-1", "leave-1")).resolves.toBe(leave)
        await expect(service.swapRow("ws-1", "swap-1")).resolves.toBe(swap)
        expect(read.callsOf("andWhere")).toEqual([["s.id = :shiftId", { shiftId: "shift-1" }]])
        expect(em.findOne).toHaveBeenCalledWith(ShiftsScheduleEntity, {
            where: { workspaceId: "ws-1", id: "schedule-1" },
        })
        expect(em.findOne).toHaveBeenCalledWith(ShiftsLeaveRequestEntity, {
            where: { workspaceId: "ws-1", id: "leave-1" },
        })
        expect(em.findOne).toHaveBeenCalledWith(ShiftsSwapRequestEntity, {
            where: { workspaceId: "ws-1", id: "swap-1" },
        })
    })
})

describe("ShiftsDataService lookups", () => {
    it("returns undefined when a shift, schedule, leave or swap does not exist", async () => {
        const em = mockEntityManager({
            findOne: [
                [ShiftsScheduleEntity, null],
                [ShiftsLeaveRequestEntity, null],
                [ShiftsSwapRequestEntity, null],
            ],
        })
        em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ getRawOne: undefined }).builder as never)
        const service = await build(em)

        await expect(service.shiftRow("ws-1", "shift-1")).resolves.toBeUndefined()
        await expect(service.scheduleRow("ws-1", "schedule-1")).resolves.toBeUndefined()
        await expect(service.leaveRow("ws-1", "leave-1")).resolves.toBeUndefined()
        await expect(service.swapRow("ws-1", "swap-1")).resolves.toBeUndefined()
    })

    it("returns a member profile id or null when the member has none", async () => {
        const em = mockEntityManager({ findOne: [ShiftsStaffEntity, null] })
        const service = await build(em)
        em.findOne.mockResolvedValueOnce(Object.assign(new ShiftsStaffEntity(), { id: "staff-1" }) as never)
        em.findOne.mockResolvedValueOnce(null as never)

        await expect(service.profileOf("ws-1", "user-1")).resolves.toBe("staff-1")
        await expect(service.profileOf("ws-1", "user-3")).resolves.toBeNull()
        expect(em.findOne).toHaveBeenNthCalledWith(1, ShiftsStaffEntity, {
            select: { id: true },
            where: { workspaceId: "ws-1", active: true, userId: "user-1" },
            order: { createdAt: "ASC" },
        })
    })

    it("counts attempts through the work items", async () => {
        const service = await build(mockEntityManager())
        workItems.countByDedupePrefix.mockResolvedValue(3)

        await expect(service.askAttempts("ws-1", "publish_schedule", "publish:schedule-1:")).resolves.toBe(3)
        expect(workItems.countByDedupePrefix).toHaveBeenCalledWith("ws-1", "publish_schedule", "publish:schedule-1:")
    })
})
