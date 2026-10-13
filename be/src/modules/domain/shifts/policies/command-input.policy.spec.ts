import { decodeCommand } from "./command-input.policy"

describe("decodeCommand", () => {
    it.each([
        ["propose-week", { week: "2026-10-12" }],
        ["explain-schedule", { scheduleId: "schedule-1" }],
        ["reassign-shift", { shiftId: "shift-1", staffId: "staff-1" }],
        [
            "add-draft-shift",
            {
                scheduleId: "schedule-1",
                date: "2026-10-12",
                start: "09:00",
                end: "17:00",
                positionId: "position-1",
                staffId: "staff-1",
            },
        ],
        ["remove-draft-shift", { shiftId: "shift-1" }],
        ["request-publish", { scheduleId: "schedule-1" }],
        ["request-swap", { kind: "swap", shiftId: "shift-1", toStaffId: "staff-1", reason: "Appointment" }],
        ["request-swap", { kind: "claim", shiftId: "shift-1", toStaffId: "staff-1", reason: "Available" }],
        ["request-leave", { from: "2026-10-12", to: "2026-10-14", reason: "Holiday" }],
        ["apply-import", { positions: "Cashier", staff: "Alex", coverage: "Monday" }],
    ])("decodes the fields of %s exactly", (kind, params) => {
        expect(decodeCommand(kind, { ...params, ignored: "extra" })).toEqual({ kind, params })
    })

    it.each([
        ["propose-week", { week: "" }],
        ["explain-schedule", { scheduleId: "" }],
        ["reassign-shift", { shiftId: "", staffId: null }],
        ["add-draft-shift", { scheduleId: "", date: "", start: "", end: "", positionId: "", staffId: null }],
        ["remove-draft-shift", { shiftId: "" }],
        ["request-publish", { scheduleId: "" }],
        ["request-swap", { kind: "swap", shiftId: "", toStaffId: null, reason: "" }],
        ["request-leave", { from: "", to: "", reason: "" }],
        ["apply-import", { positions: "", staff: "", coverage: "" }],
    ])("defaults missing and wrong-typed fields of %s", (kind, params) => {
        expect(decodeCommand(kind, {})).toEqual({ kind, params })
        expect(
            decodeCommand(kind, {
                week: 12,
                scheduleId: false,
                shiftId: [],
                staffId: 1,
                date: null,
                start: {},
                end: true,
                positionId: 2,
                kind: true,
                toStaffId: {},
                reason: false,
                from: 1,
                to: [],
                positions: {},
                staff: null,
                coverage: 1,
            }),
        ).toEqual({ kind, params })
    })

    it.each([undefined, null, "text", 7, false, ["week"]])("treats non-record input %p as no fields", (input) => {
        expect(decodeCommand("propose-week", input)).toEqual({ kind: "propose-week", params: { week: "" } })
    })

    it.each([undefined, null, "", false, 3])("normalizes an empty or invalid optional field %p to null", (staffId) => {
        expect(decodeCommand("reassign-shift", { shiftId: "shift-1", staffId })).toEqual({
            kind: "reassign-shift",
            params: { shiftId: "shift-1", staffId: null },
        })
    })

    it("defaults an unknown swap kind to swap and an empty recipient to null", () => {
        expect(
            decodeCommand("request-swap", { kind: "foreign", shiftId: "shift-1", toStaffId: "", reason: "" }),
        ).toEqual({
            kind: "request-swap",
            params: { kind: "swap", shiftId: "shift-1", toStaffId: null, reason: "" },
        })
    })

    it("returns null for an unknown command kind", () => {
        expect(decodeCommand("foreign-command", { week: "2026-10-12" })).toBeNull()
    })
})
