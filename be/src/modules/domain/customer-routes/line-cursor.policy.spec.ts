import { cursorOf, cursorTextOf } from "./line-cursor.policy"

describe("line cursor", () => {
    it("writes the said-at instant in milliseconds, a dot and the insertion number, and reads it back", () => {
        const saidAt = new Date("2026-11-14T03:00:00.000Z")

        const text = cursorTextOf({ saidAt, seq: "42" })

        expect(text).toBe(`${String(saidAt.getTime())}.42`)
        expect(cursorOf(text)).toEqual({ saidAt, seq: "42" })
    })

    it("starts at the newest for no cursor or a malformed one", () => {
        for (const bad of [undefined, null, "", "abc", "1763089140000", "1763089140000.", ".7", "17.6.5", "-1.2", "1763089140000.x"]) {
            expect(cursorOf(bad)).toBeNull()
        }
    })
})
