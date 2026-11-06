import { askedOf } from "./proposal"

describe("askedOf", () => {
    it("is what the customer said last", () => {
        expect(askedOf({ lastRole: "user", lastText: "Open on day 2?" })).toBe("Open on day 2?")
    })

    it("is nothing when someone else spoke last or nobody did", () => {
        expect(askedOf({ lastRole: "agent", lastText: "Yes" })).toBe("")
        expect(askedOf({ lastRole: "user", lastText: null })).toBe("")
    })
})
