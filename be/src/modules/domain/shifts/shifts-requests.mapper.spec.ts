import {
    toRequestShiftsSwapRequest,
    toSaveShiftsStaffRequest,
    toAddShiftsAvailabilityRequest,
    toSubmitShiftsAvailabilityRequest,
} from "./shifts-requests.mapper"

describe("shifts requests", () => {
    it("keeps the colleague of a swap and writes an absent or null one as null", () => {
        const form = { kind: "swap" as const, shiftId: "s-1", reason: "sick" }

        expect(toRequestShiftsSwapRequest("ws-1", { ...form, toStaffId: "st-2" })).toEqual({
            workspaceId: "ws-1",
            ...form,
            toStaffId: "st-2",
        })
        expect(toRequestShiftsSwapRequest("ws-1", { ...form, toStaffId: null })).toEqual({
            workspaceId: "ws-1",
            ...form,
            toStaffId: null,
        })
        expect(toRequestShiftsSwapRequest("ws-1", form)).toEqual({ workspaceId: "ws-1", ...form, toStaffId: null })
    })

    it("keeps every staff field and writes an absent staff row as null", () => {
        const form = { name: "Lan", positionIds: ["p-1"], wage: 25000, active: true }

        expect(toSaveShiftsStaffRequest("ws-1", { ...form, staffRowId: "row-1" })).toEqual({
            workspaceId: "ws-1",
            ...form,
            staffRowId: "row-1",
        })
        expect(toSaveShiftsStaffRequest("ws-1", form)).toEqual({ workspaceId: "ws-1", ...form, staffRowId: null })
    })

    it("keeps the given staff member, day, date and note of an availability window", () => {
        expect(
            toAddShiftsAvailabilityRequest("ws-1", {
                staffId: "st-1",
                weekday: 1,
                date: "2026-11-02",
                start: "08:00",
                end: "12:00",
                available: true,
                note: "mornings",
            }),
        ).toEqual({
            workspaceId: "ws-1",
            staffId: "st-1",
            weekday: 1,
            date: "2026-11-02",
            start: "08:00",
            end: "12:00",
            available: true,
            note: "mornings",
        })
    })

    it("drops an absent or null staff member and note and writes an absent day or date as null", () => {
        const expected = {
            workspaceId: "ws-1",
            weekday: null,
            date: null,
            start: "08:00",
            end: "12:00",
            available: false,
        }

        expect(
            toAddShiftsAvailabilityRequest("ws-1", {
                staffId: null,
                weekday: null,
                date: null,
                start: "08:00",
                end: "12:00",
                available: false,
                note: null,
            }),
        ).toEqual(expected)
        expect(toAddShiftsAvailabilityRequest("ws-1", { start: "08:00", end: "12:00", available: false })).toEqual(
            expected,
        )
    })

    it("maps a member's own availability window the same way", () => {
        expect(
            toSubmitShiftsAvailabilityRequest("ws-1", { weekday: 2, start: "18:00", end: "22:00", available: true }),
        ).toEqual({
            workspaceId: "ws-1",
            weekday: 2,
            date: null,
            start: "18:00",
            end: "22:00",
            available: true,
        })
    })
})
