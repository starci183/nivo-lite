import { selectedTabIndex } from "./tab-selection"

const TABS = [{ id: "a" }, { id: "b" }, { id: "c" }]

describe("selectedTabIndex", () => {
    it("finds the chosen tab", () => {
        expect(selectedTabIndex(TABS, "b")).toBe(1)
        expect(selectedTabIndex(TABS, "c")).toBe(2)
    })

    it("falls back to the first tab when nothing, or no tab of the panel, is chosen", () => {
        expect(selectedTabIndex(TABS, null)).toBe(0)
        expect(selectedTabIndex(TABS, "zzz")).toBe(0)
        expect(selectedTabIndex([], "a")).toBe(0)
    })
})
