import { TABS_MAX, tabbedPanelBlock } from "./tabbed-panel.block"

const WORD = { key: "word" }
const TAB = { id: "overview", label: WORD }
const PANEL = { label: WORD, tabs: [TAB], param: "tab" }
const accepts = (props: unknown): boolean => tabbedPanelBlock.props.safeParse(props).success

describe("tabbedPanelBlock", () => {
    it("is the core.tabbed-panel block, holding up to one child per tab and binding nothing", () => {
        expect(tabbedPanelBlock.id).toBe("core.tabbed-panel")
        expect(tabbedPanelBlock.children).toEqual({ max: TABS_MAX })
        expect(tabbedPanelBlock.slots).toEqual({})
        expect(Object.keys(tabbedPanelBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("lists param as the prop that names a spec param", () => {
        expect(tabbedPanelBlock.params).toEqual(["param"])
    })

    it("takes a label, the tabs and the param that holds the chosen tab", () => {
        expect(accepts(PANEL)).toBe(true)
        expect(accepts({ ...PANEL, tabs: [TAB, { id: "history", label: { vi: "Lich su", en: "History" } }] })).toBe(
            true,
        )
    })

    it("refuses no tab, too many tabs, a tab without an id and a param that is no word", () => {
        expect(accepts({ ...PANEL, tabs: [] })).toBe(false)
        expect(accepts({ ...PANEL, tabs: Array.from({ length: TABS_MAX + 1 }, () => TAB) })).toBe(false)
        expect(accepts({ ...PANEL, tabs: [{ id: "", label: WORD }] })).toBe(false)
        expect(accepts({ ...PANEL, tabs: [{ id: "i".repeat(65), label: WORD }] })).toBe(false)
        expect(accepts({ ...PANEL, param: "the tab" })).toBe(false)
        expect(accepts({ label: WORD, tabs: [TAB] })).toBe(false)
    })
})
