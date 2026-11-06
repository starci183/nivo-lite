import { LIST_PANE_FIXTURES, LIST_PANE_PROPS, LIST_PANE_ROWS_PROPS } from "../fixtures/list-pane.fixtures"
import { listPaneBlock } from "./list-pane.block"

describe("listPaneBlock", () => {
    it("is the core list pane, with no slots of its own and two children at most", () => {
        expect(listPaneBlock.id).toBe("core.list-pane")
        expect(listPaneBlock.slots).toEqual({})
        expect(listPaneBlock.children).toEqual({
            max: 2,
            accepts: ["core.filter-tabs", "core.record-list", "core.table", "core.board"],
        })
    })

    it("takes a search that names the param it writes, with an optional label", () => {
        expect(listPaneBlock.props.safeParse(LIST_PANE_PROPS).success).toBe(true)
        expect(listPaneBlock.props.safeParse({ search: true, searchParam: "q" }).success).toBe(true)
    })

    it("takes a title that stays above the card, and refuses one that is not text", () => {
        expect(listPaneBlock.props.safeParse({ search: false, title: { key: "pane_title" } }).success).toBe(true)
        expect(listPaneBlock.props.safeParse({ search: false, title: 3 }).success).toBe(false)
    })

    it("takes a pane without a search", () => {
        expect(listPaneBlock.props.safeParse({ search: false }).success).toBe(true)
    })

    it("refuses a search that names no param, or a param name past its bound", () => {
        expect(listPaneBlock.props.safeParse({ search: true }).success).toBe(false)
        expect(listPaneBlock.props.safeParse({ search: true, searchParam: "" }).success).toBe(false)
        expect(listPaneBlock.props.safeParse({ search: true, searchParam: "q".repeat(65) }).success).toBe(false)
    })

    it("converts to a JSON Schema for the composer", () => {
        expect(Object.keys(listPaneBlock.propsJson).length).toBeGreaterThan(0)
    })
})

describe("the list pane fixtures", () => {
    it("cover every state with every region in the same state", () => {
        expect(LIST_PANE_FIXTURES.map((fixture) => fixture.state)).toEqual([
            "ready",
            "loading",
            "empty",
            "emptyWithSearch",
            "error",
        ])
        const loading = LIST_PANE_FIXTURES.find((fixture) => fixture.state === "loading")
        expect(loading?.counts).toEqual({ isLoading: true })
        expect(loading?.rows).toEqual({ isLoading: true })
        const error = LIST_PANE_FIXTURES.find((fixture) => fixture.state === "error")
        expect(error?.counts).toEqual({ isError: true })
        expect(error?.rows).toEqual({ isError: true })
    })

    it("hold the search in the param only for the empty-with-search state", () => {
        const searched = LIST_PANE_FIXTURES.filter((fixture) => "q" in fixture.params)
        expect(searched.map((fixture) => fixture.state)).toEqual(["emptyWithSearch"])
    })

    it("hold rows of a record list that selects through a param and clears the search", () => {
        expect(LIST_PANE_ROWS_PROPS.selectParam).toBe("selected")
        expect(LIST_PANE_ROWS_PROPS.searchParam).toBe(LIST_PANE_PROPS.searchParam)
    })
})
