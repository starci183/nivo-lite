import {
    appendRow,
    fieldKeyOf,
    isListValid,
    LIST_FIELD_KINDS,
    listRowsFrom,
    moveRow,
    removeRow,
    submittedRows,
    validateRows,
    withoutFieldError,
    withRowValue,
} from "./list-rows"
import type { ListRow } from "./list-rows"

const RULES = [
    { name: "name", kind: "text" as const, required: true, max: 5 },
    { name: "rate", kind: "number" as const, max: 100 },
    { name: "isOn", kind: "switch" as const },
]
const row = (key: number, name: string): ListRow => ({ key, values: { name, rate: key, isOn: false } })
const ROWS: ReadonlyArray<ListRow> = [row(0, "a"), row(1, "b"), row(2, "c")]
const names = (rows: ReadonlyArray<ListRow>): ReadonlyArray<string | number | boolean | null | undefined> =>
    rows.map((entry) => entry.values.name)

describe("listRowsFrom", () => {
    it("reads one row per item of the list at the path, from the fields of the rules", () => {
        const record = { id: "x", tiers: [{ name: "Gold", rate: "5", isOn: true, extra: 1 }, { name: "Silver" }] }
        expect(listRowsFrom(record, "tiers", RULES, 10)).toEqual([
            { key: 0, values: { name: "Gold", rate: 5, isOn: true } },
            { key: 1, values: { name: "Silver", rate: null, isOn: false } },
        ])
    })

    it("cuts the list to the most rows the editor takes", () => {
        expect(listRowsFrom({ tiers: [{}, {}, {}] }, "tiers", RULES, 2)).toHaveLength(2)
    })

    it("holds no rows where the path holds no list, or the record is missing", () => {
        expect(listRowsFrom({ tiers: "none" }, "tiers", RULES, 5)).toEqual([])
        expect(listRowsFrom({}, "tiers", RULES, 5)).toEqual([])
        expect(listRowsFrom(undefined, "tiers", RULES, 5)).toEqual([])
    })

    it("reads a list nested in the record", () => {
        expect(listRowsFrom({ ladder: { tiers: [{ name: "A" }] } }, "ladder.tiers", RULES, 5)).toHaveLength(1)
    })
})

describe("appendRow", () => {
    it("adds an empty row with a key no row has", () => {
        const added = appendRow(ROWS, RULES, 5)
        expect(added).toHaveLength(4)
        expect(added[3]).toEqual({ key: 3, values: { name: "", rate: null, isOn: false } })
    })

    it("starts the keys at zero in an empty list, and goes past the highest key after a removal", () => {
        expect(appendRow([], RULES, 5)[0]?.key).toBe(0)
        expect(appendRow([row(4, "z")], RULES, 5)[1]?.key).toBe(5)
    })

    it("leaves a full list as it is", () => {
        expect(appendRow(ROWS, RULES, 3)).toBe(ROWS)
    })
})

describe("removeRow", () => {
    it("removes the row of the key", () => {
        expect(names(removeRow(ROWS, 1, 0))).toEqual(["a", "c"])
    })

    it("keeps a list at its fewest rows as it is", () => {
        expect(removeRow(ROWS, 1, 3)).toBe(ROWS)
    })

    it("keeps every row for a key no row has", () => {
        expect(names(removeRow(ROWS, 9, 0))).toEqual(["a", "b", "c"])
    })
})

describe("moveRow", () => {
    it("moves a row one place earlier or later", () => {
        expect(names(moveRow(ROWS, 1, -1))).toEqual(["b", "a", "c"])
        expect(names(moveRow(ROWS, 1, 1))).toEqual(["a", "c", "b"])
    })

    it("keeps a row at the edge where it is", () => {
        expect(moveRow(ROWS, 0, -1)).toBe(ROWS)
        expect(moveRow(ROWS, 2, 1)).toBe(ROWS)
    })

    it("keeps the list for a key no row has", () => {
        expect(moveRow(ROWS, 9, 1)).toBe(ROWS)
    })
})

describe("withRowValue", () => {
    it("changes one field of the row of the key and nothing else", () => {
        const changed = withRowValue(ROWS, 1, "name", "bb")
        expect(names(changed)).toEqual(["a", "bb", "c"])
        expect(changed[0]).toBe(ROWS[0])
        expect(changed[1]?.values.rate).toBe(1)
    })
})

describe("validateRows and isListValid", () => {
    it("is valid for good rows", () => {
        const errors = validateRows(RULES, ROWS, 1)
        expect(errors).toEqual({ fields: {}, list: null })
        expect(isListValid(errors)).toBe(true)
    })

    it("names each error by the position and field it was sent under", () => {
        const rows: ReadonlyArray<ListRow> = [row(0, "ok"), { key: 1, values: { name: "", rate: 500, isOn: false } }]
        const errors = validateRows(RULES, rows, 0)
        expect(Object.keys(errors.fields)).toEqual(["1.name", "1.rate"])
        expect(errors.fields["1.name"]).toEqual({ key: "formRequired" })
        expect(isListValid(errors)).toBe(false)
    })

    it("says the list is too short when it holds fewer rows than it must", () => {
        const errors = validateRows(RULES, [], 1)
        expect(errors.list).toEqual({ key: "listTooFew" })
        expect(isListValid(errors)).toBe(false)
    })
})

describe("submittedRows", () => {
    it("sends every field of every row under its position, with text trimmed", () => {
        const rows: ReadonlyArray<ListRow> = [{ key: 7, values: { name: " Gold ", rate: 5, isOn: true } }, row(8, "b")]
        expect(submittedRows(RULES, rows)).toEqual({
            "0.name": "Gold",
            "0.rate": 5,
            "0.isOn": true,
            "1.name": "b",
            "1.rate": 8,
            "1.isOn": false,
        })
    })

    it("sends the empty value of a field a row holds none for, and nothing for no rows", () => {
        expect(submittedRows(RULES, [{ key: 0, values: {} }])).toEqual({
            "0.name": "",
            "0.rate": null,
            "0.isOn": false,
        })
        expect(submittedRows(RULES, [])).toEqual({})
    })
})

describe("fieldKeyOf and withoutFieldError", () => {
    it("name a field by position and name, and drop the error of one field", () => {
        expect(fieldKeyOf(2, "rate")).toBe("2.rate")
        const errors = { "0.name": { key: "a" }, "1.name": { key: "b" } }
        expect(withoutFieldError(errors, 0, "name")).toEqual({ "1.name": { key: "b" } })
    })
})

describe("LIST_FIELD_KINDS", () => {
    it("lists the kinds a row may hold", () => {
        expect(LIST_FIELD_KINDS).toEqual(["text", "number", "money", "choice", "switch"])
    })
})
