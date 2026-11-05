import { recordsView } from "../rows/rows"
import { tableRowsOf } from "../rows/table-rows"
import { tableFixtureProps, tableFixtures } from "../fixtures/table.fixtures"
import { TABLE_ALIGNS, TABLE_COLUMNS_MAX, TABLE_PRIORITIES, tableBlock } from "./table.block"

const WORD = { key: "word" }
const COLUMN = { term: WORD, path: "name" }
const TABLE = { label: WORD, empty: WORD, idPath: "id", columns: [COLUMN] }
const accepts = (props: unknown): boolean => tableBlock.props.safeParse(props).success

describe("tableBlock", () => {
    it("is the core.table block, with no children", () => {
        expect(tableBlock.id).toBe("core.table")
        expect(tableBlock.children).toBe(false)
        expect(Object.keys(tableBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("lists selectParam and searchParam as the props that name a spec param", () => {
        expect(tableBlock.params).toEqual(["selectParam", "searchParam"])
    })

    it("takes a search param and the words of an empty search", () => {
        expect(accepts({ ...tableFixtureProps, searchParam: "q", emptySearch: { key: "none" } })).toBe(true)
        expect(accepts({ ...tableFixtureProps, searchParam: "not a param" })).toBe(false)
    })

    it("names a required rows read of a list and an optional open action", () => {
        expect(tableBlock.slots).toEqual({
            rows: { kind: "read", shape: "list", required: true },
            open: { kind: "action", required: false },
        })
    })

    it("takes the documented props, the currency and the select param being optional", () => {
        expect(accepts(TABLE)).toBe(true)
        expect(accepts({ ...TABLE, currency: "USD", selectParam: "selected" })).toBe(true)
        expect(accepts(tableFixtureProps)).toBe(true)
    })

    it("takes every format, align and priority of a column and refuses another", () => {
        const formats = ["text", "number", "money", "date", "dateTime", "badge"]
        expect(formats.every((format) => accepts({ ...TABLE, columns: [{ ...COLUMN, format }] }))).toBe(true)
        expect(TABLE_ALIGNS.every((align) => accepts({ ...TABLE, columns: [{ ...COLUMN, align }] }))).toBe(true)
        expect(TABLE_PRIORITIES.every((priority) => accepts({ ...TABLE, columns: [{ ...COLUMN, priority }] }))).toBe(
            true,
        )
        expect(accepts({ ...TABLE, columns: [{ ...COLUMN, format: "html" }] })).toBe(false)
        expect(accepts({ ...TABLE, columns: [{ ...COLUMN, align: "center" }] })).toBe(false)
        expect(accepts({ ...TABLE, columns: [{ ...COLUMN, priority: "medium" }] })).toBe(false)
    })

    it("refuses a missing column list, no column, too many columns and an oversized path", () => {
        expect(accepts({ label: WORD, empty: WORD, idPath: "id" })).toBe(false)
        expect(accepts({ ...TABLE, columns: [] })).toBe(false)
        expect(accepts({ ...TABLE, columns: Array.from({ length: TABLE_COLUMNS_MAX + 1 }, () => COLUMN) })).toBe(false)
        expect(accepts({ ...TABLE, columns: [{ ...COLUMN, path: "p".repeat(201) }] })).toBe(false)
        expect(accepts({ ...TABLE, idPath: "p".repeat(201) })).toBe(false)
    })

    it("refuses a currency that is no ISO code and a param name that is no word", () => {
        expect(accepts({ ...TABLE, currency: "dong" })).toBe(false)
        expect(accepts({ ...TABLE, currency: "usd" })).toBe(false)
        expect(accepts({ ...TABLE, selectParam: "9lives" })).toBe(false)
        expect(accepts({ ...TABLE, selectParam: "a b" })).toBe(false)
        expect(accepts({ ...TABLE, selectParam: "p".repeat(65) })).toBe(false)
    })
})

describe("tableFixtures", () => {
    it("holds a ready list that the table reads into rows, and every other status", () => {
        expect(Object.keys(tableFixtures)).toEqual(["ready", "empty", "error", "loading", "forbidden"])
        const ready = tableFixtures.ready
        expect("items" in ready).toBe(true)
        const records = "items" in ready ? recordsView.parse(ready.items) : []
        const rows = tableRowsOf(records, {
            idPath: tableFixtureProps.idPath,
            columns: tableFixtureProps.columns,
            context: { locale: "vi", currency: "VND", timeZone: "UTC" },
        })
        expect(rows?.map((row) => row.id)).toEqual(["r1", "r2", "r3"])
    })
})
