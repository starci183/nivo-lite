import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { memberOf } from "@tests/fixtures/builders/shifts-workbench.builder"
import {
    availabilityOf,
    coverageOf,
    nothingSaved,
    saved,
    settingsOf,
    shiftRowOf,
} from "@tests/fixtures/builders/shifts-setup-params.builder"
import { ShiftsErrorCode } from "./errors/shifts.error"
import {
    ShiftsAttendanceEntity,
    ShiftsAvailabilityEntity,
    ShiftsCoverageEntity,
    ShiftsPositionEntity,
    ShiftsSettingsEntity,
    ShiftsStaffEntity,
    ShiftsStaffPayEntity,
} from "./persistence/entities"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsSetupService } from "./shifts-setup.service"

/** 07:45 in Vietnam on the day of the shift, which runs 08:00 to 10:00 there. */
const BEFORE_SHIFT = "2026-10-12T00:45:00.000Z"

const Code = ShiftsErrorCode

/** The key of one row of the workspace, the criteria of a write to it. */
const rowKey = (id: string) => ({ workspaceId: "ws-1", id })

const build = async (entityManager: MockEntityManager, at: string = BEFORE_SHIFT) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(memberOf())
    const data = mock<ShiftsDataService>()
    data.shiftRow.mockResolvedValue(shiftRowOf())
    data.profileIdOfMember.mockResolvedValue("profile-1")
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

describe("ShiftsSetupService savePosition", () => {
    it("saves a trimmed position with the default colour for a manager", async () => {
        const em = mockEntityManager()
        const [insert] = queueQueryBuilders(em, [saved("position-1")])
        const { setup, members } = await build(em)

        await expect(setup.savePosition("user-1", "ws-1", { name: "  Cashier ", color: " " })).resolves.toEqual({
            id: "position-1",
        })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ShiftsPositionEntity, "s")
        expect(insert?.callsOf("values")).toEqual([[{ workspaceId: "ws-1", name: "Cashier", color: "#2f6fed" }]])
        expect(insert?.callsOf("orUpdate")).toEqual([[["color"], ["workspace_id", "name"]]])
        expect(insert?.callsOf("returning")).toEqual([["id"]])
    })

    it.each(["   ", "x".repeat(61)])("refuses the name %j", async (name) => {
        const em = mockEntityManager()
        const { setup } = await build(em)

        await expect(setup.savePosition("user-1", "ws-1", { name })).rejects.toMatchObject({
            code: Code.SetupFieldInvalid,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it.each([
        [
            "a rename of a position the workspace does not have",
            { id: "missing", name: "Bar", color: "#000000" },
            saved(null),
        ],
        ["a new position the database answers no row for", { name: " Bar " }, nothingSaved],
    ])("refuses %s", async (_name, request, answer) => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [answer])
        const { setup } = await build(em)

        await expect(setup.savePosition("user-1", "ws-1", request)).rejects.toMatchObject({ code: Code.StaffNotFound })
    })

    it.each([
        { color: undefined, expected: "#2f6fed" },
        { color: " #123456 ", expected: "#123456" },
    ])("saves the position with colour $color as $expected", async ({ color, expected }) => {
        const em = mockEntityManager()
        const [update] = queueQueryBuilders(em, [saved("position-1")])
        const { setup } = await build(em)
        await expect(setup.savePosition("user-1", "ws-1", { id: "position-1", name: " Bar ", color })).resolves.toEqual(
            { id: "position-1" },
        )
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ShiftsPositionEntity, "s")
        expect(update?.callsOf("set")).toEqual([[{ name: "Bar", color: expected }]])
        expect(update?.callsOf("where")).toEqual([["workspace_id = :workspaceId AND id = :id", rowKey("position-1")]])
        expect(update?.callsOf("returning")).toEqual([["id"]])
    })
})

describe("ShiftsSetupService removePosition and removeCoverage and removeAvailability", () => {
    it("removes each row of the workspace", async () => {
        const em = mockEntityManager({
            update: [ShiftsPositionEntity, {}],
            delete: [
                [ShiftsCoverageEntity, {}],
                [ShiftsAvailabilityEntity, {}],
            ],
        })
        const { setup } = await build(em)

        await setup.removePosition("user-1", "ws-1", { id: "position-1" })
        await setup.removeCoverage("user-1", "ws-1", { id: "block-1" })
        await setup.removeAvailability("user-1", "ws-1", { id: "avail-1" })

        expect(em.update).toHaveBeenCalledWith(ShiftsPositionEntity, rowKey("position-1"), { active: false })
        expect(em.delete.mock.calls).toEqual([
            [ShiftsCoverageEntity, rowKey("block-1")],
            [ShiftsAvailabilityEntity, rowKey("avail-1")],
        ])
    })
})

describe("ShiftsSetupService saveStaff", () => {
    it("saves the profile with blanks for missing fields and a rounded wage", async () => {
        const em = mockEntityManager({ upsert: [ShiftsStaffPayEntity, {}] })
        const [insert] = queueQueryBuilders(em, [saved("profile-1")])
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
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ShiftsStaffEntity, "s")
        expect(insert?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    name: "Minh",
                    staffId: null,
                    phone: "0901",
                    telegramChatId: null,
                    zaloUserId: null,
                    positionIds: ["position-1"],
                    maxHoursWeek: "40",
                    active: true,
                },
            ],
        ])
        const [payEntity, pay, payKeys] = em.upsert.mock.calls[0] ?? []
        expect([payEntity, evaluatedValues(pay), payKeys]).toEqual([
            ShiftsStaffPayEntity,
            { staffId: "profile-1", workspaceId: "ws-1", hourlyWageVnd: 30001, updatedAt: "now()" },
            ["staffId"],
        ])
    })

    it("saves explicit profile fields with trimmed external chat ids", async () => {
        const em = mockEntityManager()
        const [update] = queueQueryBuilders(em, [saved("profile-1")])
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
        await expect(setup.saveStaff("user-1", "ws-1", request)).resolves.toEqual({ id: "profile-1" })
        expect(update?.callsOf("set")).toEqual([
            [
                {
                    name: "Lan",
                    staffId: "staff-row-1",
                    phone: "0901",
                    telegramChatId: "tg-1",
                    zaloUserId: "zalo-1",
                    positionIds: ["position-1"],
                    maxHoursWeek: "0",
                    maxHoursDay: "0",
                    minRestHours: "0",
                    active: false,
                },
            ],
        ])
        expect(update?.callsOf("where")).toEqual([["workspace_id = :workspaceId AND id = :id", rowKey("profile-1")]])
    })
})

describe("ShiftsSetupService saveStaff pay and refusals", () => {
    it("leaves the pay alone without a wage and never stores a negative one", async () => {
        const em = mockEntityManager({ upsert: [ShiftsStaffPayEntity, {}] })
        queueQueryBuilders(em, [saved("profile-1"), saved("profile-1")])
        const { setup } = await build(em)

        await setup.saveStaff("user-1", "ws-1", { id: "profile-1", name: "Minh", positionIds: [] })
        await setup.saveStaff("user-1", "ws-1", { id: "profile-1", name: "Minh", positionIds: [], wage: -5 })

        expect(em.upsert).toHaveBeenCalledTimes(1)
        expect(em.upsert).toHaveBeenLastCalledWith(
            ShiftsStaffPayEntity,
            expect.objectContaining({ staffId: "profile-1", hourlyWageVnd: 0 }),
            ["staffId"],
        )
    })

    it("refuses a profile the workspace does not have", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [nothingSaved])
        const { setup } = await build(em)

        await expect(
            setup.saveStaff("user-1", "ws-1", { id: "missing", name: "Minh", positionIds: [] }),
        ).rejects.toMatchObject({ code: Code.StaffNotFound })
    })
})

describe("ShiftsSetupService saveCoverage", () => {
    const block = {
        startTime: "08:00",
        endTime: "12:00",
        positionId: "position-1",
        minStaff: 1,
        idealStaff: 2,
        isPeak: false,
    }

    it("saves the block for the valid weekdays only, or updates the one block to the first valid weekday", async () => {
        const em = mockEntityManager({ insert: [ShiftsCoverageEntity, {}], update: [ShiftsCoverageEntity, {}] })
        const { setup } = await build(em)

        await setup.saveCoverage("user-1", "ws-1", coverageOf({ weekdays: [0, 2, 7, 1.5] }))
        expect(em.update).not.toHaveBeenCalled()
        await setup.saveCoverage("user-1", "ws-1", coverageOf({ id: "block-1", weekdays: [9, 3, 4] }))

        expect(em.insert.mock.calls).toEqual([
            [
                ShiftsCoverageEntity,
                [
                    { workspaceId: "ws-1", weekday: 0, ...block },
                    { workspaceId: "ws-1", weekday: 2, ...block },
                ],
            ],
        ])
        expect(em.update.mock.calls).toEqual([[ShiftsCoverageEntity, rowKey("block-1"), { weekday: 3, ...block }]])
    })

    it.each([
        ["an end before the start", coverageOf({ end: "07:00" }), Code.TimeInvalid],
        ["a bad time", coverageOf({ start: "8am" }), Code.TimeInvalid],
        ["no valid weekday", coverageOf({ weekdays: [9] }), Code.SetupFieldInvalid],
        ["an ideal below the minimum", coverageOf({ min: 3, ideal: 2 }), Code.SetupFieldInvalid],
    ])("refuses %s", async (_name, request, code) => {
        const em = mockEntityManager()
        const { setup } = await build(em)

        await expect(setup.saveCoverage("user-1", "ws-1", request)).rejects.toMatchObject({ code })
        expect(em.insert).not.toHaveBeenCalled()
        expect(em.update).not.toHaveBeenCalled()
    })
})

describe("ShiftsSetupService saveSettings", () => {
    it("stores the rules with the opening hours, a blank day as closed", async () => {
        const em = mockEntityManager({ upsert: [ShiftsSettingsEntity, {}] })
        const { setup } = await build(em)

        await setup.saveSettings("user-1", "ws-1", settingsOf())

        const [entity, written, keys] = em.upsert.mock.calls[0] ?? []
        expect([entity, evaluatedValues(written), keys]).toEqual([
            ShiftsSettingsEntity,
            {
                workspaceId: "ws-1",
                openingHours: { "0": { open: "08:00", close: "22:00" }, "6": null },
                swapNoticeHours: 12,
                leaveNoticeDays: 3,
                remindMinutes: 60,
                noshowMinutes: 15,
                overtimeHoursWeek: "40",
                updatedAt: "now()",
            },
            ["workspaceId"],
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
            code: Code.SetupFieldInvalid,
        })
        expect(em.upsert).not.toHaveBeenCalled()
    })
})

describe("ShiftsSetupService addAvailability", () => {
    it("records a weekly statement approved by the manager", async () => {
        const em = mockEntityManager({ insert: [ShiftsAvailabilityEntity, { identifiers: [{ id: "avail-1" }] }] })
        const { setup } = await build(em)

        await expect(setup.addAvailability("user-1", "ws-1", availabilityOf())).resolves.toEqual({ id: "avail-1" })
        expect(em.insert).toHaveBeenCalledWith(ShiftsAvailabilityEntity, {
            workspaceId: "ws-1",
            staffId: "profile-2",
            weekday: 1,
            shiftDate: null,
            startTime: "08:00",
            endTime: "12:00",
            available: false,
            note: "school",
            status: "approved",
            decidedBy: "Lan",
        })
    })

    it.each([
        ["a statement without a person", availabilityOf({ staffId: undefined }), Code.StaffNotFound],
        ["both a day and a weekday", availabilityOf({ date: "2026-10-12" }), Code.AvailabilityInvalid],
        ["neither a day nor a weekday", availabilityOf({ weekday: null }), Code.AvailabilityInvalid],
        ["an impossible day", availabilityOf({ weekday: null, date: "2026-02-30" }), Code.AvailabilityInvalid],
        ["a weekday out of range", availabilityOf({ weekday: 8 }), Code.AvailabilityInvalid],
    ])("refuses %s", async (_name, request, code) => {
        const em = mockEntityManager()
        const { setup } = await build(em)

        await expect(setup.addAvailability("user-1", "ws-1", request)).rejects.toMatchObject({ code })
        expect(em.insert).not.toHaveBeenCalled()
    })
})

describe("ShiftsSetupService submitAvailability", () => {
    it("files a dated statement of the member's own profile as pending, matching a member with no shop staff row by account", async () => {
        const em = mockEntityManager({ insert: [ShiftsAvailabilityEntity, { identifiers: [] }] })
        const { setup, members, data } = await build(em)

        await expect(
            setup.submitAvailability(
                "user-1",
                "ws-1",
                availabilityOf({ staffId: undefined, weekday: null, date: "2026-10-14", note: undefined }),
            ),
        ).resolves.toEqual({ id: "" })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", [])
        expect(data.profileIdOfMember).toHaveBeenCalledWith("ws-1", "user-1", "staff-row-1")
        expect(em.insert).toHaveBeenCalledWith(
            ShiftsAvailabilityEntity,
            expect.objectContaining({
                staffId: "profile-1",
                weekday: null,
                shiftDate: "2026-10-14",
                note: "",
                status: "pending",
                decidedBy: null,
            }),
        )

        members.require.mockResolvedValue(memberOf({ staffId: null }))
        await setup.submitAvailability("user-1", "ws-1", availabilityOf({ staffId: undefined }))

        expect(data.profileIdOfMember).toHaveBeenLastCalledWith("ws-1", "user-1", null)
    })

    it("refuses a member without a shifts profile", async () => {
        const { setup, data } = await build(mockEntityManager())
        data.profileIdOfMember.mockResolvedValue(null)

        await expect(setup.submitAvailability("user-1", "ws-1", availabilityOf())).rejects.toMatchObject({
            code: Code.ProfileMissing,
        })
    })
})

describe("ShiftsSetupService decideAvailability", () => {
    it.each([
        [true, "approved"],
        [false, "declined"],
    ])("records approve=%s as %s by the manager, once, for a pending statement", async (approve, status) => {
        const em = mockEntityManager({ update: [ShiftsAvailabilityEntity, {}] })
        const { setup } = await build(em)

        await setup.decideAvailability("user-1", "ws-1", { id: "avail-1", approve })

        expect(em.update).toHaveBeenCalledWith(
            ShiftsAvailabilityEntity,
            { workspaceId: "ws-1", id: "avail-1", status: "pending" },
            { status, decidedBy: "Lan" },
        )
    })
})

describe("ShiftsSetupService checkIn", () => {
    it("checks the person in to their own shift and answers the stored instant", async () => {
        const em = mockEntityManager()
        const [insert] = queueQueryBuilders(em, [
            { execute: { raw: [{ checked_in_at: "2026-10-12T00:45:00+00:00" }] } },
        ])
        const { setup, data } = await build(em)

        await expect(setup.checkIn("user-1", "ws-1", { shiftId: "shift-1" })).resolves.toEqual({
            at: "2026-10-12T00:45:00+00:00",
        })
        expect(data.shiftRow).toHaveBeenCalledWith("ws-1", "shift-1")
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ShiftsAttendanceEntity, "s")
        expect(insert?.callsOf("values")).toEqual([[{ workspaceId: "ws-1", shiftId: "shift-1", staffId: "profile-1" }]])
        expect(insert?.callsOf("returning")).toEqual([["checked_in_at"]])
    })

    it.each([
        ["a missing time answered by the clock", [{ checked_in_at: null }], null, BEFORE_SHIFT],
        [
            "a stored Date as ISO",
            [{ checked_in_at: new Date("2026-10-12T00:40:00.000Z") }],
            null,
            "2026-10-12T00:40:00.000Z",
        ],
        [
            "the first check-in when this one conflicted",
            [],
            { checkedInAt: new Date("2026-10-12T00:35:00.000Z") },
            "2026-10-12T00:35:00.000Z",
        ],
    ])("answers %s", async (_name, raw, existing, at) => {
        const em = mockEntityManager({
            findOne: [ShiftsAttendanceEntity, existing === null ? null : entityOf(ShiftsAttendanceEntity, existing)()],
        })
        queueQueryBuilders(em, [{ execute: { raw } }])
        const { setup } = await build(em)

        await expect(setup.checkIn("user-1", "ws-1", { shiftId: "shift-1" })).resolves.toEqual({ at })
        if (raw.length === 0) {
            expect(em.findOne).toHaveBeenLastCalledWith(ShiftsAttendanceEntity, {
                where: { shiftId: "shift-1", staffId: "profile-1" },
            })
        }
    })

    it.each([
        ["a missing shift", BEFORE_SHIFT, undefined, Code.ShiftNotFound],
        ["somebody else's shift", BEFORE_SHIFT, shiftRowOf({ staffId: "profile-9" }), Code.CheckinNotYours],
        ["a check-in more than thirty minutes early", "2026-10-12T00:29:00.000Z", shiftRowOf(), Code.CheckinEarly],
        ["a check-in after the end of the shift", "2026-10-12T03:01:00.000Z", shiftRowOf(), Code.CheckinClosed],
    ])("refuses %s", async (_name, at, shift, code) => {
        const em = mockEntityManager()
        const { setup, data } = await build(em, at)
        data.shiftRow.mockResolvedValue(shift)

        await expect(setup.checkIn("user-1", "ws-1", { shiftId: "shift-1" })).rejects.toMatchObject({ code })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
