import { Test } from "@nestjs/testing"
import type { ShiftsSettingsRow, ShiftsShiftRow, ShiftsStaffRow } from "../persistence/shifts.rows"
import {
    DEFAULT_SETTINGS,
    priorOf,
    toAvail,
    toBlock,
    toLeave,
    toPosition,
    toSettings,
    toShift,
    toStaff,
} from "./row-mappers.policy"

const SUBJECT = Symbol("row-mappers.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    priorOf,
                    toAvail,
                    toBlock,
                    toLeave,
                    toPosition,
                    toSettings,
                    toShift,
                    toStaff,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./row-mappers.policy")>(SUBJECT)
}

const staffRow: ShiftsStaffRow = {
    id: "staff-1",
    name: "Alex",
    staff_id: "office-1",
    phone: "0123456789",
    telegram_chat_id: "telegram-1",
    zalo_user_id: "zalo-1",
    position_ids: ["position-1"],
    skills: ["Latte art"],
    max_hours_week: "40",
    max_hours_day: "8",
    min_rest_hours: "12",
    active: true,
}

const settingsRow: ShiftsSettingsRow = {
    opening_hours: { 0: { open: "07:00", close: "22:00" }, 6: { open: "09:00", close: "18:00" } },
    swap_notice_hours: 12,
    leave_notice_days: 3,
    remind_minutes: 30,
    noshow_minutes: 15,
    overtime_hours_week: "40",
}

const shiftRow: ShiftsShiftRow = {
    id: "shift-1",
    schedule_id: "schedule-1",
    shift_date: "2026-10-11",
    start_time: "08:30:00",
    end_time: "17:00:00",
    position_id: "position-1",
    staff_id: "staff-1",
    status: "published",
    schedule_status: "published",
    week_start: "2026-10-05",
}

describe("row mappers", () => {
    it("keeps a position color and supplies the default for empty color", async () => {
        const subject = await build()

        expect(subject.toPosition({ id: "position-1", name: "Cashier", color: "#123456" })).toEqual({
            id: "position-1",
            name: "Cashier",
            color: "#123456",
        })
        expect(subject.toPosition({ id: "position-2", name: "Barista", color: "" })).toEqual({
            id: "position-2",
            name: "Barista",
            color: "#2f6fed",
        })
    })

    it("maps a staff profile with decimal limits and the caller-supplied wage", async () => {
        const subject = await build()

        expect(subject.toStaff(staffRow, 30000)).toEqual({
            id: "staff-1",
            name: "Alex",
            staffRowId: "office-1",
            phone: "0123456789",
            telegramChatId: "telegram-1",
            zaloUserId: "zalo-1",
            positionIds: ["position-1"],
            skills: ["Latte art"],
            maxWeek: 40,
            maxDay: 8,
            minRest: 12,
            wage: 30000,
            active: true,
        })
    })

    it.each([
        { max_hours_week: 0, max_hours_day: "unreadable", min_rest_hours: -1 },
        { max_hours_week: "unreadable", max_hours_day: 0, min_rest_hours: "unreadable" },
    ])("uses default limits for zero or unreadable hours and invalid rest %p", async (limits) => {
        const subject = await build()

        expect(
            subject.toStaff(
                {
                    ...staffRow,
                    ...limits,
                    staff_id: null,
                    phone: null,
                    telegram_chat_id: null,
                    zalo_user_id: null,
                    active: false,
                },
                0,
            ),
        ).toEqual({
            id: "staff-1",
            name: "Alex",
            staffRowId: null,
            phone: null,
            telegramChatId: null,
            zaloUserId: null,
            positionIds: ["position-1"],
            skills: ["Latte art"],
            maxWeek: 48,
            maxDay: 10,
            minRest: 10,
            wage: 0,
            active: false,
        })
    })
})

describe("row mappers", () => {
    it("allows a zero rest limit", async () => {
        const subject = await build()

        expect(subject.toStaff({ ...staffRow, min_rest_hours: 0 }, 0)).toEqual({
            id: "staff-1",
            name: "Alex",
            staffRowId: "office-1",
            phone: "0123456789",
            telegramChatId: "telegram-1",
            zaloUserId: "zalo-1",
            positionIds: ["position-1"],
            skills: ["Latte art"],
            maxWeek: 40,
            maxDay: 8,
            minRest: 0,
            wage: 0,
            active: true,
        })
    })

    it("maps a coverage block and normalizes database times", async () => {
        const subject = await build()

        expect(
            subject.toBlock({
                id: "block-1",
                weekday: 2,
                start_time: "08:30:00",
                end_time: "12:00:00",
                position_id: "position-1",
                min_staff: 2,
                ideal_staff: 3,
                is_peak: true,
            }),
        ).toEqual({
            id: "block-1",
            weekday: 2,
            start: "08:30",
            end: "12:00",
            positionId: "position-1",
            min: 2,
            ideal: 3,
            peak: true,
        })
    })

    it("returns the exact settings defaults when there is no settings row", async () => {
        const subject = await build()

        expect(subject.toSettings(undefined)).toEqual({
            openingHours: [],
            swapNoticeHours: 24,
            leaveNoticeDays: 2,
            remindMinutes: 60,
            noshowMinutes: 10,
            overtimeHoursWeek: 48,
        })
        expect(subject.toSettings(undefined)).toBe(DEFAULT_SETTINGS)
    })

    it("maps settings with numeric weekdays and decimal overtime hours", async () => {
        const subject = await build()

        expect(subject.toSettings(settingsRow)).toEqual({
            openingHours: [
                { weekday: 0, open: "07:00", close: "22:00" },
                { weekday: 6, open: "09:00", close: "18:00" },
            ],
            swapNoticeHours: 12,
            leaveNoticeDays: 3,
            remindMinutes: 30,
            noshowMinutes: 15,
            overtimeHoursWeek: 40,
        })
    })
})

describe("row mappers", () => {
    it.each([undefined, null, [], "invalid", 1])("ignores non-record opening hours %p", async (opening_hours) => {
        const subject = await build()

        expect(subject.toSettings({ ...settingsRow, opening_hours, overtime_hours_week: 0 })).toEqual({
            openingHours: [],
            swapNoticeHours: 12,
            leaveNoticeDays: 3,
            remindMinutes: 30,
            noshowMinutes: 15,
            overtimeHoursWeek: 48,
        })
    })

    it("ignores malformed opening days while retaining complete text windows", async () => {
        const subject = await build()

        expect(
            subject.toSettings({
                ...settingsRow,
                opening_hours: {
                    0: null,
                    1: [],
                    2: { open: 7, close: "22:00" },
                    3: { open: "07:00", close: 22 },
                    4: { close: "22:00" },
                    5: { open: "07:00" },
                    6: { open: "09:00", close: "18:00" },
                },
                overtime_hours_week: "invalid",
            }),
        ).toEqual({
            openingHours: [{ weekday: 6, open: "09:00", close: "18:00" }],
            swapNoticeHours: 12,
            leaveNoticeDays: 3,
            remindMinutes: 30,
            noshowMinutes: 15,
            overtimeHoursWeek: 48,
        })
    })

    it("maps date-based availability and normalizes its times", async () => {
        const subject = await build()

        expect(
            subject.toAvail({
                staff_id: "staff-1",
                weekday: null,
                shift_date: "2026-10-12",
                start_time: "09:00:00",
                end_time: "15:00:00",
                available: false,
            }),
        ).toEqual({
            staffId: "staff-1",
            weekday: null,
            date: "2026-10-12",
            start: "09:00",
            end: "15:00",
            available: false,
        })
    })
})

describe("row mappers", () => {
    it("maps approved leave dates without persistence metadata", async () => {
        const subject = await build()

        expect(
            subject.toLeave({
                id: "leave-1",
                staff_id: "staff-1",
                from_date: "2026-10-12",
                to_date: "2026-10-14",
                reason: "Holiday",
                status: "approved",
            }),
        ).toEqual({
            staffId: "staff-1",
            from: "2026-10-12",
            to: "2026-10-14",
        })
    })
})

describe("row mappers", () => {
    it("maps a shift without schedule metadata", async () => {
        const subject = await build()

        expect(subject.toShift(shiftRow)).toEqual({
            id: "shift-1",
            date: "2026-10-11",
            start: "08:30",
            end: "17:00",
            positionId: "position-1",
            staffId: "staff-1",
            status: "published",
        })
    })

    it("groups prior work by person in row order and skips open shifts", async () => {
        const subject = await build()

        expect(subject.priorOf([])).toEqual(new Map())
        expect(
            subject.priorOf([
                { ...shiftRow, staff_id: null },
                shiftRow,
                { ...shiftRow, id: "shift-2", start_time: "18:00:00", end_time: "21:00:00" },
                { ...shiftRow, id: "shift-3", staff_id: "staff-2" },
            ]),
        ).toEqual(
            new Map([
                [
                    "staff-1",
                    [
                        { date: "2026-10-11", s: 510, e: 1020, pos: "position-1" },
                        { date: "2026-10-11", s: 1080, e: 1260, pos: "position-1" },
                    ],
                ],
                ["staff-2", [{ date: "2026-10-11", s: 510, e: 1020, pos: "position-1" }]],
            ]),
        )
    })
})
