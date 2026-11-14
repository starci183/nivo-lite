import {
    LIST_EDITOR_FIXTURE_RECORD,
    listEditorFixtureProps,
    listEditorFixtures,
    listEditorOutcomes,
} from "../fixtures/list-editor.fixtures"
import { validateFields } from "../rows/form-values"
import { LIST_FIELDS_MAX, LIST_ROWS_MAX, listRowsFrom, submittedRows, validateRows } from "../rows/list-rows"
import { listEditorBlock } from "./list-editor.block"

const WORD = { key: "word" }
const FIELD = { name: "rate", label: WORD, kind: "number" }
const EDITOR = {
    label: WORD,
    listPath: "tiers",
    fields: [FIELD],
    maxRows: 5,
    addLabel: WORD,
    removeLabel: WORD,
    submitLabel: WORD,
}
const accepts = (props: unknown): boolean => listEditorBlock.props.safeParse(props).success

describe("listEditorBlock", () => {
    it("is the core.list-editor block, with no children", () => {
        expect(listEditorBlock.id).toBe("core.list-editor")
        expect(listEditorBlock.children).toBe(false)
        expect(Object.keys(listEditorBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("reads a record when it has one and must bind the save action", () => {
        expect(listEditorBlock.slots).toEqual({
            record: { kind: "read", shape: "record", required: false },
            submit: { kind: "action", required: true },
        })
    })

    it("takes the documented props, the rest being optional", () => {
        expect(accepts(EDITOR)).toBe(true)
        expect(accepts(listEditorFixtureProps)).toBe(true)
    })

    it("takes a field of every kind a row holds and refuses the others", () => {
        const kinds = ["text", "number", "money", "choice", "switch"]
        expect(kinds.every((kind) => accepts({ ...EDITOR, fields: [{ ...FIELD, kind }] }))).toBe(true)
        expect(accepts({ ...EDITOR, fields: [{ ...FIELD, kind: "textarea" }] })).toBe(false)
        expect(accepts({ ...EDITOR, fields: [{ ...FIELD, kind: "date" }] })).toBe(false)
    })

    it("refuses no field, too many fields and two fields of one name", () => {
        expect(accepts({ ...EDITOR, fields: [] })).toBe(false)
        const many = Array.from({ length: LIST_FIELDS_MAX + 1 }, (_, index) => ({ ...FIELD, name: `f${index}` }))
        expect(accepts({ ...EDITOR, fields: many })).toBe(false)
        expect(accepts({ ...EDITOR, fields: many.slice(0, LIST_FIELDS_MAX) })).toBe(true)
        expect(accepts({ ...EDITOR, fields: [FIELD, FIELD] })).toBe(false)
    })

    it("bounds the rows: a maximum is required, within the limit, and the minimum cannot pass it", () => {
        const { maxRows: _maxRows, ...withoutMax } = EDITOR
        expect(accepts(withoutMax)).toBe(false)
        expect(accepts({ ...EDITOR, maxRows: 0 })).toBe(false)
        expect(accepts({ ...EDITOR, maxRows: LIST_ROWS_MAX })).toBe(true)
        expect(accepts({ ...EDITOR, maxRows: LIST_ROWS_MAX + 1 })).toBe(false)
        expect(accepts({ ...EDITOR, maxRows: 2.5 })).toBe(false)
        expect(accepts({ ...EDITOR, minRows: 5 })).toBe(true)
        expect(accepts({ ...EDITOR, minRows: 6 })).toBe(false)
        expect(accepts({ ...EDITOR, minRows: -1 })).toBe(false)
    })

    it("asks for the words of moving rows when they can move", () => {
        expect(accepts({ ...EDITOR, isReorderable: true })).toBe(false)
        expect(accepts({ ...EDITOR, isReorderable: true, moveUpLabel: WORD })).toBe(false)
        expect(accepts({ ...EDITOR, isReorderable: true, moveUpLabel: WORD, moveDownLabel: WORD })).toBe(true)
        expect(accepts({ ...EDITOR, isReorderable: false })).toBe(true)
    })

    it("refuses missing words, an empty or oversized path and a currency that is no ISO code", () => {
        const { addLabel: _addLabel, ...withoutAdd } = EDITOR
        expect(accepts(withoutAdd)).toBe(false)
        expect(accepts({ ...EDITOR, listPath: "" })).toBe(false)
        expect(accepts({ ...EDITOR, listPath: "p".repeat(201) })).toBe(false)
        expect(accepts({ ...EDITOR, idPath: "p".repeat(201) })).toBe(false)
        expect(accepts({ ...EDITOR, currency: "dong" })).toBe(false)
        expect(accepts({ ...EDITOR, currency: "VND", idPath: "id", successNotice: WORD, emptyRows: WORD })).toBe(true)
    })
})

describe("listEditorFixtures", () => {
    it("holds every status of the record read, and the answers a save may give", () => {
        expect(Object.keys(listEditorFixtures)).toEqual(["ready", "noRows", "empty", "error", "loading", "forbidden"])
        expect(Object.keys(listEditorOutcomes)).toEqual(["saved", "invalid", "conflict", "failed"])
    })

    it("fills the sample editor from its record, which passes the rules of its fields", () => {
        const rows = listRowsFrom(
            LIST_EDITOR_FIXTURE_RECORD,
            listEditorFixtureProps.listPath,
            listEditorFixtureProps.fields,
            listEditorFixtureProps.maxRows,
        )
        expect(rows).toHaveLength(3)
        expect(
            rows.every((row) => Object.keys(validateFields(listEditorFixtureProps.fields, row.values)).length === 0),
        ).toBe(true)
        const errors = validateRows(listEditorFixtureProps.fields, rows, listEditorFixtureProps.minRows ?? 0)
        expect(errors).toEqual({ fields: {}, list: null })
    })

    it("saves the sample ladder as the position and name of each field, and refuses a field of a row that exists", () => {
        const rows = listRowsFrom(LIST_EDITOR_FIXTURE_RECORD, "tiers", listEditorFixtureProps.fields, 6)
        const sent = submittedRows(listEditorFixtureProps.fields, rows)
        expect(sent["1.name"]).toBe("Bac")
        expect(sent["2.isActive"]).toBe(false)
        const invalid = listEditorOutcomes.invalid
        const refused = !invalid.ok && invalid.reason === "invalid" ? Object.keys(invalid.fields) : []
        expect(refused.every((key) => key in sent)).toBe(true)
    })

    it("holds a ladder with no tier for the rows-empty state", () => {
        const slot = listEditorFixtures.noRows
        const record = "items" in slot ? slot.items : null
        expect(listRowsFrom(record, "tiers", listEditorFixtureProps.fields, 6)).toEqual([])
    })
})
