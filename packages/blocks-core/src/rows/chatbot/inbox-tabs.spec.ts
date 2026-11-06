import { TODAY_TOKEN, paramsOfTab, tabOf } from "./inbox-tabs"

describe("tabOf", () => {
    it("names the today tab for the period, the needs tab for that status, else the all tab", () => {
        expect(tabOf(null, TODAY_TOKEN)).toBe("today")
        expect(tabOf("needs", TODAY_TOKEN)).toBe("today")
        expect(tabOf("needs", null)).toBe("needs")
        expect(tabOf("handled", null)).toBe("all")
        expect(tabOf(null, null)).toBe("all")
        expect(tabOf(null, "$thisWeek")).toBe("all")
    })
})

describe("paramsOfTab", () => {
    it("sets one thing per tab and clears the other", () => {
        expect(paramsOfTab("today")).toEqual({ status: null, period: "$today" })
        expect(paramsOfTab("needs")).toEqual({ status: "needs", period: null })
        expect(paramsOfTab("all")).toEqual({ status: null, period: null })
    })
})
