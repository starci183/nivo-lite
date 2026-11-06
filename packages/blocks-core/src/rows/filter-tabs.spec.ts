import {
    ALL_TAB,
    countsView,
    EMPTY_TAB_COUNTS,
    moreLabelOf,
    selectedTab,
    tabEntriesOf,
    TAB_COUNTS_PLACEHOLDER,
    tabParamValue,
} from "./filter-tabs"
import type { TabSpec } from "./filter-tabs"

const SPECS: ReadonlyArray<TabSpec> = [
    { value: "new", label: "New", attention: true },
    { value: "won", label: "Won", attention: false },
]

describe("tabEntriesOf", () => {
    it("puts the all tab first with the total, then one tab per value with its count", () => {
        expect(tabEntriesOf("All", SPECS, { counts: { new: 4, won: 2 }, total: 6 })).toEqual([
            { id: ALL_TAB, label: "All", count: 6 },
            { id: "new", label: "New", count: 4, isAttention: true },
            { id: "won", label: "Won", count: 2 },
        ])
    })

    it("reads a value the counts do not name as zero and draws no warning for it", () => {
        expect(tabEntriesOf("All", SPECS, { counts: {}, total: 0 })).toEqual([
            { id: ALL_TAB, label: "All", count: 0 },
            { id: "new", label: "New", count: 0 },
            { id: "won", label: "Won", count: 0 },
        ])
    })

    it("draws the labels alone while the counts are unknown", () => {
        expect(tabEntriesOf("All", SPECS, null)).toEqual([
            { id: ALL_TAB, label: "All" },
            { id: "new", label: "New" },
            { id: "won", label: "Won" },
        ])
    })
})

describe("selectedTab", () => {
    it("is the value of the param when a tab holds it", () => {
        expect(selectedTab("won", SPECS)).toBe("won")
    })

    it("is the all tab when the param is absent or names no tab", () => {
        expect(selectedTab(null, SPECS)).toBe(ALL_TAB)
        expect(selectedTab("lost", SPECS)).toBe(ALL_TAB)
        expect(selectedTab(ALL_TAB, SPECS)).toBe(ALL_TAB)
    })
})

describe("tabParamValue", () => {
    it("clears the param for the all tab and writes the value of any other", () => {
        expect(tabParamValue(ALL_TAB)).toBeNull()
        expect(tabParamValue("won")).toBe("won")
    })
})

describe("countsView", () => {
    it("accepts the counts per value and the total", () => {
        expect(countsView.safeParse({ counts: { new: 1 }, total: 1 }).success).toBe(true)
        expect(countsView.safeParse(TAB_COUNTS_PLACEHOLDER).success).toBe(true)
    })

    it("refuses a count that is not a whole non-negative number, or a missing total", () => {
        expect(countsView.safeParse({ counts: { new: -1 }, total: 1 }).success).toBe(false)
        expect(countsView.safeParse({ counts: { new: 1.5 }, total: 1 }).success).toBe(false)
        expect(countsView.safeParse({ counts: {} }).success).toBe(false)
    })

    it("refuses more counts than a block lists tabs", () => {
        const counts = Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`v${index}`, 1]))
        expect(countsView.safeParse({ counts, total: 51 }).success).toBe(false)
    })
})

describe("moreLabelOf", () => {
    it("puts the number of folded tabs where the message asks", () => {
        expect(moreLabelOf("{count} more filters", 3)).toBe("3 more filters")
        expect(moreLabelOf("{count} + {count}", 2)).toBe("2 + 2")
    })
})

describe("EMPTY_TAB_COUNTS", () => {
    it("keeps every tab with a count of zero", () => {
        const entries = tabEntriesOf("All", SPECS, EMPTY_TAB_COUNTS)
        expect(entries.length).toBe(SPECS.length + 1)
        expect(entries.every((entry) => entry.count === 0)).toBe(true)
    })
})
