import { fieldText } from "./gate-fields.policy"

describe("fieldText", () => {
    it("reads a missing or null fact as empty text", () => {
        expect(fieldText({}, "missing")).toBe("")
        expect(fieldText({ value: null }, "value")).toBe("")
    })

    it("renders every non-null gate field value as text", () => {
        const fields = { text: "shift-1", empty: "", number: 24, zero: 0, yes: true, no: false }

        expect(fieldText(fields, "text")).toBe("shift-1")
        expect(fieldText(fields, "empty")).toBe("")
        expect(fieldText(fields, "number")).toBe("24")
        expect(fieldText(fields, "zero")).toBe("0")
        expect(fieldText(fields, "yes")).toBe("true")
        expect(fieldText(fields, "no")).toBe("false")
    })
})
