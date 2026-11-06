import { DEFAULT_FOLLOW_DAYS, dueAfter } from "./follow"

const NOW = new Date("2026-11-05T09:00:00.000Z")

describe("dueAfter", () => {
    it("is two days after now when the owner names no days", () => {
        expect(DEFAULT_FOLLOW_DAYS).toBe(2)
        expect(dueAfter(NOW, undefined)).toBe("2026-11-07T09:00:00.000Z")
    })

    it("is the named number of days after now", () => {
        expect(dueAfter(NOW, 7)).toBe("2026-11-12T09:00:00.000Z")
    })
})
