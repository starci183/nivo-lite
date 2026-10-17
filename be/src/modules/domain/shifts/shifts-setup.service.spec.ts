import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ShiftsErrorCode } from "./errors/shifts.error"
import type { ShiftsShiftRow } from "./persistence/shifts.rows"
import {
    CHECK_IN,
    DECIDE_AVAILABILITY,
    INSERT_AVAILABILITY,
    REMOVE_AVAILABILITY,
    REMOVE_COVERAGE,
    REMOVE_POSITION,
    SAVE_COVERAGE,
    SAVE_POSITION,
    SAVE_STAFF_PROFILE,
    SELECT_PROFILE_OF_MEMBER,
    UPSERT_PAY,
    UPSERT_SETTINGS,
} from "./persistence/shifts-workbench.sql"
import { ShiftsDataService } from "./shifts-data.service"
import type {
    SaveCoverageParams,
    SaveShiftsAvailabilityParams,
    SaveShiftsSettingsParams,
} from "./shifts-setup.contracts"
import { ShiftsSetupService } from "./shifts-setup.service"

/** 07:45 in Vietnam on the day of the shift, which runs 08:00 to 10:00 there. */
const BEFORE_SHIFT = "2026-10-12T00:45:00.000Z"

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: "staff-row-1",
    displayName: "Lan",
    status: "active",
})

const shiftRowOf = builder<ShiftsShiftRow>({
    id: "shift-1",
    schedule_id: "schedule-1",
    shift_date: "2026-10-12",
    start_time: "08:00",
    end_time: "10:00",
    position_id: "position-1",
    staff_id: "profile-1",
    status: "published",
    schedule_status: "published",
    week_start: "2026-10-12",
})

const coverageOf = builder<SaveCoverageParams>({
    weekdays: [0, 2],
    start: "08:00",
    end: "12:00",
    positionId: "position-1",
    min: 1,
    ideal: 2,
    peak: false,
})

const settingsOf = builder<SaveShiftsSettingsParams>({
    swapNoticeHours: 12,
    leaveNoticeDays: 3,
    remindMinutes: 60,
    noshowMinutes: 15,
    overtimeHoursWeek: 40,
    openingHours: [
        { weekday: 0, open: "08:00", close: "22:00" },
        { weekday: 6, open: "", close: "" },
    ],
})

const availabilityOf = builder<SaveShiftsAvailabilityParams>({
    staffId: "profile-2",
    weekday: 1,
    date: null,
    start: "08:00",
    end: "12:00",
    available: false,
    note: "  school  ",
})

const build = async (entityManager: MockEntityManager, at: string = BEFORE_SHIFT) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(memberOf())
    const data = mock<ShiftsDataService>()
    data.shiftRow.mockResolvedValue(shiftRowOf())
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsSetupService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(at) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ShiftsDataService, useValue: data },
        ],
    }).compile()
    return { setup: moduleRef.get(ShiftsSetupService), members, data }
}

const profile = [SELECT_PROFILE_OF_MEMBER, [{ id: "profile-1" }]] as const
describe("ShiftsSetupService savePosition", () => {
    it("saves a trimmed position with the default colour for a manager", async () => {
        const em = mockEntityManager({ query: [SAVE_POSITION, [{ id: "position-1" }]] })
        const { setup, members } = await build(em)

        await expect(setup.savePosition("user-1", "ws-1", { name: "  Cashier ", color: " " })).resolves.toEqual({
            id: "position-1",
        })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(em.query).toHaveBeenCalledWith(SAVE_POSITION, ["ws-1", null, "Cashier", "#2f6fed"])
    })

    it.each(["   ", "x".repeat(61)])("refuses the name %j", async (name) => {
        const em = mockEntityManager()
        const { setup } = await build(em)

        await expect(setup.savePosition("user-1", "ws-1", { name })).rejects.toMatchObject({
            code: ShiftsErrorCode.SetupFieldInvalid,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses a rename of a position the workspace does not have", async () => {
        const { setup } = await build(mockEntityManager({ query: [SAVE_POSITION, [{ id: null }]] }))

        await expect(
            setup.savePosition("user-1", "ws-1", { id: "missing", name: "Bar", color: "#000000" }),
        ).rejects.toMatchObject({ code: ShiftsErrorCode.StaffNotFound })
    })

    it("uses the default colour and refuses a position save returning no row", async () => {
        const em = mockEntityManager({ query: [SAVE_POSITION, []] })
        const { setup } = await build(em)
        await expect(setup.savePosition("user-1", "ws-1", { name: " Bar " })).rejects.toMatchObject({
            code: ShiftsErrorCode.StaffNotFound,
        })
        expect(em.query.mock.calls).toEqual([[SAVE_POSITION, ["ws-1", null, "Bar", "#2f6fed"]]])
    })

    it.each([
        { color: undefined, expected: "#2f6fed" },
        { color: " #123456 ", expected: "#123456" },
    ])("saves the position with colour $color as $expected", async ({ color, expected }) => {
        const em = mockEntityManager({ query: [SAVE_POSITION, [{ id: "position-1" }]] })
        const { setup } = await build(em)
        await expect(setup.savePosition("user-1", "ws-1", { id: "position-1", name: " Bar ", color })).resolves.toEqual(
            { id: "position-1" },
        )
        expect(em.query.mock.calls).toEqual([[SAVE_POSITION, ["ws-1", "position-1", "Bar", expected]]])
    })
})

describe("ShiftsSetupService removePosition and removeCoverage and removeAvailability", () => {
    it("removes each row of the workspace", async () => {
        const em = mockEntityManager({
            query: [
                [REMOVE_POSITION, []],
                [REMOVE_COVERAGE, []],
                [REMOVE_AVAILABILITY, []],
            ],
        })
        const { setup } = await build(em)

        await setup.removePosition("user-1", "ws-1", { id: "position-1" })
        await setup.removeCoverage("user-1", "ws-1", { id: "block-1" })
        await setup.removeAvailability("user-1", "ws-1", { id: "avail-1" })

        expect(em.query.mock.calls).toEqual([
            [REMOVE_POSITION, ["ws-1", "position-1"]],
            [REMOVE_COVERAGE, ["ws-1", "block-1"]],
            [REMOVE_AVAILABILITY, ["ws-1", "avail-1"]],
        ])
    })
})

describe("ShiftsSetupService saveStaff", () => {
    it("saves the profile with blanks for missing fields and a rounded wage", async () => {
        const em = mockEntityManager({
            query: [
                [SAVE_STAFF_PROFILE, [{ id: "profile-1" }]],
                [UPSERT_PAY, []],
            ],
        })
        const { setup } = await build(em)

        await expect(
            setup.saveStaff("user-1", "ws-1", {
                name: " Minh ",
                positionIds: ["position-1"],
                phone: " 0901 ",
                wage: 30000.6,
                maxWeek: 40,
            }),
        ).resolves.toEqual({ id: "profile-1" })
        expect(em.query.mock.calls).toEqual([
            [
                SAVE_STAFF_PROFILE,
                [
                    "ws-1",
                    null,
                    JSON.stringify({
                        name: "Minh",
                        staffRowId: "",
                        phone: "0901",
                        telegramChatId: "",
                        zaloUserId: "",
                        positionIds: ["position-1"],
                        maxWeek: 40,
                        maxDay: "",
                        minRest: "",
                        active: true,
                    }),
                ],
            ],
            [UPSERT_PAY, ["ws-1", "profile-1", 30001]],
        ])
    })

    it("saves explicit profile fields with trimmed external chat ids", async () => {
        const em = mockEntityManager({ query: [SAVE_STAFF_PROFILE, [{ id: "profile-1" }]] })
        const { setup } = await build(em)
        const request = {
            id: "profile-1",
            name: " Lan ",
            positionIds: ["position-1"],
            staffRowId: "staff-row-1",
            phone: " 0901 ",
            telegramChatId: " tg-1 ",
            zaloUserId: " zalo-1 ",
            maxWeek: 0,
            maxDay: 0,
            minRest: 0,
            active: false,
        }
        const profile = JSON.stringify({
            name: "Lan",
            staffRowId: "staff-row-1",
            phone: "0901",
            telegramChatId: "tg-1",
            zaloUserId: "zalo-1",
            positionIds: ["position-1"],
            maxWeek: 0,
            maxDay: 0,
            minRest: 0,
            active: false,
        })
        await expect(setup.saveStaff("user-1", "ws-1", request)).resolves.toEqual({ id: "profile-1" })
        expect(em.query.mock.calls).toEqual([[SAVE_STAFF_PROFILE, ["ws-1", "profile-1", profile]]])
    })
})

describe("ShiftsSetupService saveStaff", () => {
    it("leaves the pay alone without a wage and never stores a negative one", async () => {
        const em = mockEntityManager({
            query: [
                [SAVE_STAFF_PROFILE, [{ id: "profile-1" }]],
                [SAVE_STAFF_PROFILE, [{ id: "profile-1" }]],
                [UPSERT_PAY, []],
            ],
        })
        const { setup } = await build(em)

        await setup.saveStaff("user-1", "ws-1", { id: "profile-1", name: "Minh", positionIds: [] })
        await setup.saveStaff("user-1", "ws-1", { id: "profile-1", name: "Minh", positionIds: [], wage: -5 })

        expect(em.query).toHaveBeenCalledTimes(3)
        expect(em.query).toHaveBeenLastCalledWith(UPSERT_PAY, ["ws-1", "profile-1", 0])
    })

    it("refuses a profile the workspace does not have", async () => {
        const { setup } = await build(mockEntityManager({ query: [SAVE_STAFF_PROFILE, []] }))

        await expect(
            setup.saveStaff("user-1", "ws-1", { id: "missing", name: "Minh", positionIds: [] }),
        ).rejects.toMatchObject({ code: ShiftsErrorCode.StaffNotFound })
    })
})

describe("ShiftsSetupService saveCoverage", () => {
    it("saves the block for the valid weekdays only", async () => {
        const em = mockEntityManager({ query: [SAVE_COVERAGE, []] })
        const { setup } = await build(em)

        await setup.saveCoverage("user-1", "ws-1", coverageOf({ weekdays: [0, 2, 7, 1.5] }))

        expect(em.query).toHaveBeenCalledWith(SAVE_COVERAGE, [
            "ws-1",
            null,
            [0, 2],
            "08:00",
            "12:00",
            "position-1",
            1,
            2,
            false,
        ])
    })

    it.each([
        ["an end before the start", coverageOf({ end: "07:00" }), ShiftsErrorCode.TimeInvalid],
        ["a bad time", coverageOf({ start: "8am" }), ShiftsErrorCode.TimeInvalid],
        ["no valid weekday", coverageOf({ weekdays: [9] }), ShiftsErrorCode.SetupFieldInvalid],
        ["an ideal below the minimum", coverageOf({ min: 3, ideal: 2 }), ShiftsErrorCode.SetupFieldInvalid],
    ])("refuses %s", async (_name, request, code) => {
        const em = mockEntityManager()
        const { setup } = await build(em)

        await expect(setup.saveCoverage("user-1", "ws-1", request)).rejects.toMatchObject({ code })
        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("ShiftsSetupService saveSettings", () => {
    it("stores the rules with the opening hours, a blank day as closed", async () => {
        const em = mockEntityManager({ query: [UPSERT_SETTINGS, []] })
        const { setup } = await build(em)

        await setup.saveSettings("user-1", "ws-1", settingsOf())

        expect(em.query).toHaveBeenCalledWith(UPSERT_SETTINGS, [
            "ws-1",
            JSON.stringify({ "0": { open: "08:00", close: "22:00" }, "6": null }),
            12,
            3,
            60,
            15,
            40,
        ])
    })

    it.each([
        ["a weekday out of range", { weekday: 7, open: "08:00", close: "22:00" }],
        ["a closing before the opening", { weekday: 1, open: "22:00", close: "08:00" }],
        ["a bad time", { weekday: 1, open: "8", close: "22:00" }],
    ])("refuses %s", async (_name, day) => {
        const em = mockEntityManager()
        const { setup } = await build(em)

        await expect(setup.saveSettings("user-1", "ws-1", settingsOf({ openingHours: [day] }))).rejects.toMatchObject({
            code: ShiftsErrorCode.SetupFieldInvalid,
        })
        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("ShiftsSetupService addAvailability", () => {
    it("records a weekly statement approved by the manager", async () => {
        const em = mockEntityManager({ query: [INSERT_AVAILABILITY, [{ id: "avail-1" }]] })
        const { setup } = await build(em)

        await expect(setup.addAvailability("user-1", "ws-1", availabilityOf())).resolves.toEqual({ id: "avail-1" })
        expect(em.query).toHaveBeenCalledWith(INSERT_AVAILABILITY, [
            "ws-1",
            "profile-2",
            1,
            null,
            "08:00",
            "12:00",
            false,
            "school",
            "approved",
            "Lan",
        ])
    })

    it("refuses a statement without a person", async () => {
        const { setup } = await build(mockEntityManager())

        await expect(
            setup.addAvailability("user-1", "ws-1", availabilityOf({ staffId: undefined })),
        ).rejects.toMatchObject({ code: ShiftsErrorCode.StaffNotFound })
    })

    it.each([
        ["both a day and a weekday", availabilityOf({ date: "2026-10-12" })],
        ["neither a day nor a weekday", availabilityOf({ weekday: null })],
        ["an impossible day", availabilityOf({ weekday: null, date: "2026-02-30" })],
        ["a weekday out of range", availabilityOf({ weekday: 8 })],
    ])("refuses %s", async (_name, request) => {
        const em = mockEntityManager()
        const { setup } = await build(em)

        await expect(setup.addAvailability("user-1", "ws-1", request)).rejects.toMatchObject({
            code: ShiftsErrorCode.AvailabilityInvalid,
        })
        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("ShiftsSetupService submitAvailability", () => {
    it("files a dated statement of the member's own profile as pending", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_PROFILE_OF_MEMBER, [{ id: "profile-1" }]],
                [INSERT_AVAILABILITY, []],
            ],
        })
        const { setup, members } = await build(em)

        await expect(
            setup.submitAvailability(
                "user-1",
                "ws-1",
                availabilityOf({ staffId: undefined, weekday: null, date: "2026-10-14", note: undefined }),
            ),
        ).resolves.toEqual({ id: "" })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", [])
        expect(em.query.mock.calls).toEqual([
            [SELECT_PROFILE_OF_MEMBER, ["ws-1", "user-1", "staff-row-1"]],
            [
                INSERT_AVAILABILITY,
                ["ws-1", "profile-1", null, "2026-10-14", "08:00", "12:00", false, "", "pending", null],
            ],
        ])
    })

    it("refuses a member without a shifts profile", async () => {
        const { setup } = await build(mockEntityManager({ query: [SELECT_PROFILE_OF_MEMBER, []] }))

        await expect(setup.submitAvailability("user-1", "ws-1", availabilityOf())).rejects.toMatchObject({
            code: ShiftsErrorCode.ProfileMissing,
        })
    })
})

describe("ShiftsSetupService decideAvailability", () => {
    it.each([
        [true, "approved"],
        [false, "declined"],
    ])("records approve=%s as %s by the manager", async (approve, status) => {
        const em = mockEntityManager({ query: [DECIDE_AVAILABILITY, []] })
        const { setup } = await build(em)

        await setup.decideAvailability("user-1", "ws-1", { id: "avail-1", approve })

        expect(em.query).toHaveBeenCalledWith(DECIDE_AVAILABILITY, ["ws-1", "avail-1", status, "Lan"])
    })
})

describe("ShiftsSetupService checkIn", () => {
    it("checks the person in to their own shift and answers the stored instant", async () => {
        const em = mockEntityManager({
            query: [profile, [CHECK_IN, [{ checked_in_at: "2026-10-12T00:45:00+00:00" }]]],
        })
        const { setup, data } = await build(em)

        await expect(setup.checkIn("user-1", "ws-1", { shiftId: "shift-1" })).resolves.toEqual({
            at: "2026-10-12T00:45:00+00:00",
        })
        expect(data.shiftRow).toHaveBeenCalledWith("ws-1", "shift-1")
        expect(em.query).toHaveBeenLastCalledWith(CHECK_IN, ["ws-1", "shift-1", "profile-1"])
    })

    it.each([
        [null, BEFORE_SHIFT],
        [new Date("2026-10-12T00:40:00.000Z"), "2026-10-12T00:40:00.000Z"],
    ])("answers a missing time from the clock and a stored Date as ISO: %p", async (checkedInAt, at) => {
        const em = mockEntityManager({
            query: [profile, [CHECK_IN, [{ checked_in_at: checkedInAt }]]],
        })
        const { setup } = await build(em)

        await expect(setup.checkIn("user-1", "ws-1", { shiftId: "shift-1" })).resolves.toEqual({ at })
    })

    it("refuses a missing shift", async () => {
        const { setup, data } = await build(mockEntityManager({ query: [profile] }))
        data.shiftRow.mockResolvedValue(undefined)

        await expect(setup.checkIn("user-1", "ws-1", { shiftId: "missing" })).rejects.toMatchObject({
            code: ShiftsErrorCode.ShiftNotFound,
        })
    })

    it("refuses somebody else's shift", async () => {
        const { setup, data } = await build(mockEntityManager({ query: [profile] }))
        data.shiftRow.mockResolvedValue(shiftRowOf({ staff_id: "profile-9" }))

        await expect(setup.checkIn("user-1", "ws-1", { shiftId: "shift-1" })).rejects.toMatchObject({
            code: ShiftsErrorCode.CheckinNotYours,
        })
    })

    it.each([
        ["more than thirty minutes early", "2026-10-12T00:29:00.000Z", ShiftsErrorCode.CheckinEarly],
        ["after the end of the shift", "2026-10-12T03:01:00.000Z", ShiftsErrorCode.CheckinClosed],
    ])("refuses a check-in %s", async (_name, at, code) => {
        const em = mockEntityManager({ query: [profile] })
        const { setup } = await build(em, at)

        await expect(setup.checkIn("user-1", "ws-1", { shiftId: "shift-1" })).rejects.toMatchObject({ code })
        expect(em.query).not.toHaveBeenCalledWith(CHECK_IN, ["ws-1", "shift-1", "profile-1"])
    })
})
