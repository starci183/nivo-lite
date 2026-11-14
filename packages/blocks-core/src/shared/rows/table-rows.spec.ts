import {
    alignOf,
    cellOf,
    chosenIdOf,
    columnIdOf,
    columnOfId,
    selectedIdsOf,
    tablePlaceholder,
    tableRowsOf,
} from "./table-rows"

const CONTEXT = { locale: "en", currency: "USD", timeZone: "UTC" }
const SPEC = {
    idPath: "id",
    columns: [
        { path: "name" },
        { path: "amount", format: "money" as const },
        { path: "state", format: "badge" as const },
        { path: "owner.name", format: "text" as const },
    ],
    context: CONTEXT,
}

describe("tableRowsOf", () => {
    it("draws one row per record with each cell formatted by its column", () => {
        const rows = tableRowsOf([{ id: "a", name: "First", amount: 12, state: "paid", owner: { name: "An" } }], SPEC)
        expect(rows).toEqual([
            { id: "a", cells: { c0: "First", c1: "$12.00", c2: "paid", c3: "An" }, notes: {}, tones: {} },
        ])
    })

    it("draws an empty cell where the path is missing, and a numeric id as text", () => {
        expect(tableRowsOf([{ id: 2, name: "Second" }], SPEC)).toEqual([
            { id: "2", cells: { c0: "Second", c1: "", c2: "", c3: "" }, notes: {}, tones: {} },
        ])
    })

    it("skips a record without a text id", () => {
        expect(tableRowsOf([{ name: "No id" }, { id: "b", name: "B" }], SPEC)?.map((row) => row.id)).toEqual(["b"])
    })

    it("draws a badge or text cell in the words its path is given", () => {
        const label = (path: string, raw: string): string => (path === "state" && raw === "paid" ? "Da tra" : raw)
        const rows = tableRowsOf([{ id: "a", name: "First", state: "paid", owner: { name: "paid" } }], {
            ...SPEC,
            context: { ...CONTEXT, label },
        })
        expect(rows).toEqual([
            { id: "a", cells: { c0: "First", c1: "", c2: "Da tra", c3: "paid" }, notes: {}, tones: {} },
        ])
    })

    it("draws the line under a value and the tone of a badge from the paths and tones a column names", () => {
        const spec = {
            ...SPEC,
            columns: [
                { path: "name", subPath: "note" },
                { path: "state", format: "badge" as const, tones: { paid: "success" as const } },
                { path: "other", subPath: "missing" },
            ],
        }
        const rows = tableRowsOf([{ id: "a", name: "First", note: "n", state: "paid" }], spec)
        expect(rows?.[0]?.notes).toEqual({ c0: "n" })
        expect(rows?.[0]?.tones).toEqual({ c1: "success" })
    })

    it("is null when no row can be drawn", () => {
        expect(tableRowsOf([], SPEC)).toBeNull()
        expect(tableRowsOf([{ name: "No id" }], SPEC)).toBeNull()
    })
})

describe("tablePlaceholder", () => {
    it("holds three blank rows with a cell for every column", () => {
        const rows = tablePlaceholder(2)
        expect(rows.map((row) => row.id)).toEqual(["placeholder-0", "placeholder-1", "placeholder-2"])
        expect(rows.every((row) => Object.keys(row.cells).join() === "c0,c1")).toBe(true)
    })
})

describe("columnIdOf and columnOfId", () => {
    it("issue an id per index and find the column back", () => {
        expect(columnIdOf(3)).toBe("c3")
        expect(columnOfId(["x", "y"], "c1")).toBe("y")
        expect(columnOfId(["x", "y"], "c9")).toBeUndefined()
    })
})

describe("cellOf", () => {
    const row = {
        id: "a",
        cells: { c0: "First", c2: "paid", c3: "" },
        notes: { c0: "note" },
        tones: { c2: "success" as const },
    }

    it("says a badge column's text is drawn as a badge", () => {
        expect(cellOf(SPEC.columns, row, "c2")).toEqual({ text: "paid", isBadge: true, note: "", tone: "success" })
    })

    it("draws other columns, an empty badge and an unknown column as plain text", () => {
        expect(cellOf(SPEC.columns, row, "c0")).toEqual({
            text: "First",
            isBadge: false,
            note: "note",
            tone: "neutral",
        })
        expect(
            cellOf([{ path: "x", format: "badge" }], { id: "a", cells: { c0: "" }, notes: {}, tones: {} }, "c0"),
        ).toEqual({
            text: "",
            isBadge: false,
            note: "",
            tone: "neutral",
        })
        expect(cellOf(SPEC.columns, row, "c8")).toEqual({ text: "", isBadge: false, note: "", tone: "neutral" })
    })
})

describe("alignOf", () => {
    it("ends numbers and money, starts the rest, and obeys an explicit align", () => {
        expect(alignOf({ format: "number" })).toBe("end")
        expect(alignOf({ format: "money" })).toBe("end")
        expect(alignOf({ format: "text" })).toBe("start")
        expect(alignOf({})).toBe("start")
        expect(alignOf({ format: "number", align: "start" })).toBe("start")
        expect(alignOf({ format: "text", align: "end" })).toBe("end")
    })
})

describe("selectedIdsOf and chosenIdOf", () => {
    it("mark the chosen id as selected and read the chosen id back from a selection", () => {
        expect(selectedIdsOf("a")).toEqual(["a"])
        expect(selectedIdsOf(null)).toEqual([])
        expect(chosenIdOf(["b", "c"])).toBe("b")
        expect(chosenIdOf([])).toBeNull()
        expect(chosenIdOf("all")).toBeNull()
    })
})
