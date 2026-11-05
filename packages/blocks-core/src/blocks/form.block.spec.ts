import { formFixtureProps, formFixtures, formOutcomes, FORM_FIXTURE_RECORD } from "../fixtures/form.fixtures"
import { initialValues, validateFields } from "../rows/form-values"
import { FORM_FIELDS_MAX, FORM_OPTIONS_MAX, formBlock } from "./form.block"

const WORD = { key: "word" }
const FIELD = { name: "title", label: WORD, kind: "text" }
const FORM = { label: WORD, submitLabel: WORD, fields: [FIELD] }
const accepts = (props: unknown): boolean => formBlock.props.safeParse(props).success

describe("formBlock", () => {
    it("is the core.form block, with no children", () => {
        expect(formBlock.id).toBe("core.form")
        expect(formBlock.children).toBe(false)
        expect(Object.keys(formBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("reads a record when it has one and must bind the submit action", () => {
        expect(formBlock.slots).toEqual({
            record: { kind: "read", shape: "record", required: false },
            submit: { kind: "action", required: true },
        })
    })

    it("takes the documented props", () => {
        expect(accepts(FORM)).toBe(true)
        expect(accepts({ ...FORM, successNotice: WORD, idPath: "uuid", currency: "VND" })).toBe(true)
        expect(accepts(formFixtureProps)).toBe(true)
    })

    it("takes a field of every kind and refuses another kind", () => {
        const kinds = ["text", "number", "money", "textarea", "switch", "choice", "date"]
        expect(kinds.every((kind) => accepts({ ...FORM, fields: [{ ...FIELD, kind }] }))).toBe(true)
        expect(accepts({ ...FORM, fields: [{ ...FIELD, kind: "file" }] })).toBe(false)
    })

    it("takes the options, hint, required and max of a field", () => {
        const field = {
            ...FIELD,
            kind: "choice",
            hint: WORD,
            required: true,
            max: 10,
            options: [{ value: "a", label: WORD }],
        }
        expect(accepts({ ...FORM, fields: [field] })).toBe(true)
        expect(accepts({ ...FORM, fields: [{ ...field, max: 0 }] })).toBe(false)
        expect(accepts({ ...FORM, fields: [{ ...field, max: 1e13 }] })).toBe(false)
        expect(accepts({ ...FORM, fields: [{ ...field, required: "yes" }] })).toBe(false)
    })

    it("refuses a field name that is no word, no field, too many fields and too many options", () => {
        expect(accepts({ ...FORM, fields: [{ ...FIELD, name: "a b" }] })).toBe(false)
        expect(accepts({ ...FORM, fields: [{ ...FIELD, name: "1st" }] })).toBe(false)
        expect(accepts({ ...FORM, fields: [{ ...FIELD, name: "n".repeat(65) }] })).toBe(false)
        expect(accepts({ ...FORM, fields: [] })).toBe(false)
        expect(accepts({ ...FORM, fields: Array.from({ length: FORM_FIELDS_MAX + 1 }, () => FIELD) })).toBe(false)
        const options = Array.from({ length: FORM_OPTIONS_MAX + 1 }, () => ({ value: "a", label: WORD }))
        expect(accepts({ ...FORM, fields: [{ ...FIELD, options }] })).toBe(false)
        expect(accepts({ ...FORM, fields: [{ ...FIELD, options: [{ value: "", label: WORD }] }] })).toBe(false)
    })

    it("refuses a form without its submit words and a currency that is no ISO code", () => {
        expect(accepts({ label: WORD, fields: [FIELD] })).toBe(false)
        expect(accepts({ ...FORM, currency: "dong" })).toBe(false)
    })
})

describe("formFixtures", () => {
    it("holds every status of the record read, and the answers a submit may give", () => {
        expect(Object.keys(formFixtures)).toEqual(["ready", "empty", "error", "loading", "forbidden"])
        expect(Object.keys(formOutcomes)).toEqual(["saved", "invalid", "conflict", "failed"])
    })

    it("fills the sample form from its record, which passes the field rules", () => {
        const values = initialValues(formFixtureProps.fields, FORM_FIXTURE_RECORD)
        expect(values).toMatchObject({ title: "Tang mot ly ca phe", points: 120, tier: "silver", until: "2026-12-31" })
        expect(validateFields(formFixtureProps.fields, values)).toEqual({})
    })
})
