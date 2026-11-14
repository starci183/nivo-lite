import { listCardBlock } from "./list-card.block"

const BASE = {
    label: { key: "rows" },
    empty: { key: "rows_empty" },
    idPath: "id",
    titlePath: "name",
    selectParam: "selected",
    search: false,
}
const FILTERS = {
    filterParam: "status",
    filterAll: { key: "all" },
    filters: [{ value: "open", label: { key: "open" } }],
}

describe("listCardBlock", () => {
    it("is the core list card: a counts read that may be left unbound, the rows read, and no children", () => {
        expect(listCardBlock.id).toBe("core.list-card")
        expect(listCardBlock.slots).toEqual({
            counts: { kind: "read", shape: "record", required: false },
            rows: { kind: "read", shape: "list", required: true },
        })
        expect(listCardBlock.children).toBe(false)
        expect(listCardBlock.params).toEqual(["selectParam", "searchParam", "filterParam"])
    })

    it("takes the rows with a chosen-row param, with or without a title, a search and a filter", () => {
        expect(listCardBlock.props.safeParse(BASE).success).toBe(true)
        expect(listCardBlock.props.safeParse({ ...BASE, title: { key: "t" }, ...FILTERS }).success).toBe(true)
        expect(listCardBlock.props.safeParse({ ...BASE, search: true, searchParam: "q" }).success).toBe(true)
    })

    it("refuses a search that names no param, and a row list that names no chosen-row param", () => {
        expect(listCardBlock.props.safeParse({ ...BASE, search: true }).success).toBe(false)
        const { selectParam: _omitted, ...without } = BASE
        expect(listCardBlock.props.safeParse(without).success).toBe(false)
    })

    it("refuses a filter that is half given, and one with a repeated value or the value of the all tab", () => {
        expect(listCardBlock.props.safeParse({ ...BASE, filterParam: "status" }).success).toBe(false)
        expect(listCardBlock.props.safeParse({ ...BASE, filters: FILTERS.filters }).success).toBe(false)
        const twice = [FILTERS.filters[0], FILTERS.filters[0]]
        expect(listCardBlock.props.safeParse({ ...BASE, ...FILTERS, filters: twice }).success).toBe(false)
        const all = [{ value: "all", label: { key: "all" } }]
        expect(listCardBlock.props.safeParse({ ...BASE, ...FILTERS, filters: all }).success).toBe(false)
    })

    it("converts to a JSON Schema for the composer", () => {
        expect(Object.keys(listCardBlock.propsJson).length).toBeGreaterThan(0)
    })
})
