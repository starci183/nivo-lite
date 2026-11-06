import { boardFixtureProps, boardFixtures } from "../fixtures/board.fixtures"
import { boardBlock } from "./board.block"

const accepts = (props: unknown): boolean => boardBlock.props.safeParse(props).success

describe("boardBlock", () => {
    it("is the core.board block, with no children", () => {
        expect(boardBlock.id).toBe("core.board")
        expect(boardBlock.children).toBe(false)
        expect(Object.keys(boardBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("lists the selection and the search as the props that name a spec param", () => {
        expect(boardBlock.params).toEqual(["selectParam", "searchParam"])
    })

    it("names a required rows read of a list and an optional move action", () => {
        expect(boardBlock.slots).toEqual({
            rows: { kind: "read", shape: "list", required: true },
            move: { kind: "action", required: false },
        })
    })

    it("takes the fixture props, the optional paths and params, and refuses a board with no column", () => {
        expect(accepts(boardFixtureProps)).toBe(true)
        expect(
            accepts({
                ...boardFixtureProps,
                descriptionPath: "note",
                badgePath: "tag",
                metaPath: "when",
                selectParam: "selected",
                searchParam: "q",
                emptySearch: { key: "none" },
            }),
        ).toBe(true)
        expect(accepts({ ...boardFixtureProps, columns: [] })).toBe(false)
        expect(accepts({ ...boardFixtureProps, searchParam: "not a param" })).toBe(false)
    })

    it("refuses two columns that hold the same value", () => {
        const [first] = boardFixtureProps.columns
        expect(accepts({ ...boardFixtureProps, columns: [first, first] })).toBe(false)
    })
})

describe("boardFixtures", () => {
    it("holds a ready list with a card in every declared column and every other status", () => {
        expect(Object.keys(boardFixtures)).toEqual(["ready", "empty", "error", "loading", "forbidden"])
        const ready = boardFixtures.ready
        expect("items" in ready).toBe(true)
        const values = "items" in ready ? ready.items.map((record) => record.stage) : []
        expect(new Set(values)).toEqual(new Set(boardFixtureProps.columns.map((column) => column.value)))
    })
})
