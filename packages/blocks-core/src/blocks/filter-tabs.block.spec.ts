import { FILTER_TABS_FIXTURES, FILTER_TABS_PROPS } from "../fixtures/filter-tabs.fixtures"
import { filterTabsBlock } from "./filter-tabs.block"

const WORD = { key: "word" }

type Item = { readonly value: string; readonly label: typeof WORD }

const parses = (items: ReadonlyArray<Item>): boolean =>
    filterTabsBlock.props.safeParse({ param: "stage", all: WORD, items }).success

describe("filterTabsBlock", () => {
    it("is the core filter tabs, with a counts read of one record and no children", () => {
        expect(filterTabsBlock.id).toBe("core.filter-tabs")
        expect(filterTabsBlock.slots).toEqual({ counts: { kind: "read", shape: "record", required: true } })
        expect(filterTabsBlock.children).toBe(false)
    })

    it("takes the param, the all tab and the filter values with their words", () => {
        expect(filterTabsBlock.props.safeParse(FILTER_TABS_PROPS).success).toBe(true)
        expect(parses([])).toBe(true)
    })

    it("refuses a missing param or all tab", () => {
        expect(filterTabsBlock.props.safeParse({ all: WORD, items: [] }).success).toBe(false)
        expect(filterTabsBlock.props.safeParse({ param: "stage", items: [] }).success).toBe(false)
    })

    it("refuses a repeated value and the reserved value of the all tab", () => {
        expect(
            parses([
                { value: "a", label: WORD },
                { value: "a", label: WORD },
            ]),
        ).toBe(false)
        expect(parses([{ value: "all", label: WORD }])).toBe(false)
        expect(
            parses([
                { value: "a", label: WORD },
                { value: "b", label: WORD },
            ]),
        ).toBe(true)
    })

    it("refuses an empty value, a value past its bound and more tabs than a block lists", () => {
        expect(parses([{ value: "", label: WORD }])).toBe(false)
        expect(parses([{ value: "v".repeat(65), label: WORD }])).toBe(false)
        expect(parses(Array.from({ length: 51 }, (_, index) => ({ value: `v${index}`, label: WORD })))).toBe(false)
    })

    it("converts to a JSON Schema for the composer", () => {
        expect(Object.keys(filterTabsBlock.propsJson).length).toBeGreaterThan(0)
    })
})

describe("the filter tabs fixtures", () => {
    it("cover ready, a chosen tab, loading, empty and error", () => {
        expect(FILTER_TABS_FIXTURES.map((fixture) => fixture.state)).toEqual([
            "ready",
            "selected",
            "loading",
            "empty",
            "error",
        ])
    })

    it("choose a tab the props list", () => {
        const values = FILTER_TABS_PROPS.items.map((item) => item.value)
        const selected = FILTER_TABS_FIXTURES.find((fixture) => fixture.state === "selected")
        expect(values).toContain(selected?.selected)
    })
})
