import {
    emptyValueOf,
    formRecordSlot,
    FORM_KINDS,
    initialValues,
    mergedErrors,
    numberForField,
    numberFromField,
    recordIdOf,
    submittedValues,
    validateFields,
    withoutError,
    withValue,
} from "./form-values"
import type { FormFieldRule } from "./form-values"

const RULES: ReadonlyArray<FormFieldRule> = [
    { name: "title", kind: "text", required: true, max: 5 },
    { name: "note", kind: "textarea" },
    { name: "points", kind: "number", required: true, max: 100 },
    { name: "price", kind: "money" },
    { name: "active", kind: "switch" },
    { name: "tier", kind: "choice", required: true, options: [{ value: "gold" }, { value: "silver" }] },
    { name: "until", kind: "date" },
]

describe("emptyValueOf", () => {
    it("is null for numbers, false for a switch and empty text for the rest", () => {
        expect(FORM_KINDS.map(emptyValueOf)).toEqual(["", null, null, "", false, "", ""])
    })
})

describe("initialValues", () => {
    it("reads each field from the record in the form of its kind", () => {
        const record = {
            title: "Gift",
            note: "n",
            points: "40",
            price: 9.5,
            active: true,
            tier: "gold",
            until: "2026-12-31T00:00:00Z",
        }
        expect(initialValues(RULES, record)).toEqual({
            title: "Gift",
            note: "n",
            points: 40,
            price: 9.5,
            active: true,
            tier: "gold",
            until: "2026-12-31",
        })
    })

    it("starts a form with no record, or a record that does not fit, empty", () => {
        const empty = { title: "", note: "", points: null, price: null, active: false, tier: "", until: "" }
        expect(initialValues(RULES, {})).toEqual(empty)
        expect(initialValues(RULES, { points: "many", active: "yes", title: { a: 1 } })).toEqual(empty)
    })
})

describe("withValue", () => {
    it("changes one field and leaves the rest", () => {
        expect(withValue({ a: "1", b: 2 }, "b", 3)).toEqual({ a: "1", b: 3 })
    })
})

describe("numberFromField and numberForField", () => {
    it("turn an emptied number field into no value and back", () => {
        expect(numberFromField(Number.NaN)).toBeNull()
        expect(numberFromField(0)).toBe(0)
        expect(numberForField(null)).toBeNaN()
        expect(numberForField(undefined)).toBeNaN()
        expect(numberForField("3")).toBeNaN()
        expect(numberForField(3)).toBe(3)
    })
})

describe("validateFields", () => {
    const good = { title: "Gift", note: "", points: 5, price: null, active: false, tier: "gold", until: "" }

    it("accepts good values", () => {
        expect(validateFields(RULES, good)).toEqual({})
        expect(validateFields(RULES, { ...good, until: "2026-02-28", price: 3, title: "  Gift  " })).toEqual({})
    })

    it("asks for every required field that holds no value", () => {
        const errors = validateFields(RULES, { ...good, title: "   ", points: null, tier: "" })
        expect(errors).toEqual({
            title: { key: "formRequired" },
            points: { key: "formRequired" },
            tier: { key: "formRequired" },
        })
        expect(validateFields(RULES, {})).toMatchObject({ title: { key: "formRequired" } })
    })

    it("asks for a switch that must be on", () => {
        const rules: ReadonlyArray<FormFieldRule> = [
            { name: "agree", kind: "switch", required: true },
            { name: "other", kind: "switch" },
        ]
        expect(validateFields(rules, { agree: false, other: false })).toEqual({ agree: { key: "formRequired" } })
        expect(validateFields(rules, { agree: true })).toEqual({})
    })

    it("refuses text past its length and a number past its largest", () => {
        expect(validateFields(RULES, { ...good, title: "Too long" })).toEqual({ title: { key: "formTooLong" } })
        expect(validateFields(RULES, { ...good, points: 101 })).toEqual({ points: { key: "formTooBig" } })
        expect(validateFields(RULES, { ...good, price: 1_000_000 })).toEqual({})
    })

    it("refuses a day that is not a real day and a choice that is not offered", () => {
        expect(validateFields(RULES, { ...good, until: "31/12/2026" })).toEqual({ until: { key: "formDateInvalid" } })
        expect(validateFields(RULES, { ...good, until: "2026-13-45" })).toEqual({ until: { key: "formDateInvalid" } })
        expect(validateFields(RULES, { ...good, tier: "bronze" })).toEqual({ tier: { key: "formChoiceInvalid" } })
    })

    it("refuses any choice when the field offers none", () => {
        const rules: ReadonlyArray<FormFieldRule> = [{ name: "tier", kind: "choice" }]
        expect(validateFields(rules, { tier: "gold" })).toEqual({ tier: { key: "formChoiceInvalid" } })
        expect(validateFields(rules, { tier: "" })).toEqual({})
    })
})

describe("submittedValues", () => {
    it("sends only the declared fields, trimmed, with empty values for fields never touched", () => {
        expect(submittedValues(RULES, { title: "  Gift ", points: 5, other: "x" })).toEqual({
            title: "Gift",
            note: "",
            points: 5,
            price: null,
            active: false,
            tier: "",
            until: "",
        })
    })
})

describe("withoutError and mergedErrors", () => {
    it("drops the error of one field", () => {
        expect(withoutError({ a: { key: "x" }, b: { key: "y" } }, "a")).toEqual({ b: { key: "y" } })
    })

    it("lets the server's errors win over the ones found here", () => {
        expect(mergedErrors({ a: { key: "x" }, b: { key: "y" } }, { a: { key: "server" } })).toEqual({
            a: { key: "server" },
            b: { key: "y" },
        })
    })
})

describe("formRecordSlot", () => {
    it("turns an empty slot into a record to fill and leaves every other status", () => {
        expect(formRecordSlot({ isEmpty: true })).toEqual({ items: {} })
        expect(formRecordSlot({ isLoading: true })).toEqual({ isLoading: true })
        expect(formRecordSlot({ isError: true })).toEqual({ isError: true })
        expect(formRecordSlot({ items: { id: "a" } })).toEqual({ items: { id: "a" } })
    })
})

describe("recordIdOf", () => {
    it("reads the id of the record and is empty for a form that creates", () => {
        expect(recordIdOf({ id: "r1" }, "id")).toBe("r1")
        expect(recordIdOf({}, "id")).toBe("")
    })
})
