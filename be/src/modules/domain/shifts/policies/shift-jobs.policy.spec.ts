import { shiftsJobOf } from "./shift-jobs.policy"

describe("shiftsJobOf", () => {
    it("reads a tick, a reminder and a no-show check", () => {
        expect(shiftsJobOf({ kind: "tick" })).toEqual({ kind: "tick" })
        expect(shiftsJobOf({ kind: "remind", workspaceId: "w", shiftId: "s", extra: 1 })).toEqual({
            kind: "remind",
            workspaceId: "w",
            shiftId: "s",
        })
        expect(shiftsJobOf({ kind: "noshow", workspaceId: "w", shiftId: "s" })).toEqual({
            kind: "noshow",
            workspaceId: "w",
            shiftId: "s",
        })
    })

    it.each([
        undefined,
        null,
        "tick",
        [],
        {},
        { kind: "other" },
        { kind: "remind", workspaceId: "w" },
        { kind: "noshow", shiftId: 1 },
    ])("drops %p", (payload) => {
        expect(shiftsJobOf(payload)).toBeNull()
    })
})
