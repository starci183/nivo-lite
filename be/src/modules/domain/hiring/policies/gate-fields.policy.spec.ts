import { fieldNumber, fieldText } from "./gate-fields.policy"

describe("gate fields policy", () => {
    describe("fieldText", () => {
        it("returns empty text for absent and null fields", () => {
            expect(fieldText({}, "missing")).toBe("")
            expect(fieldText({ value: null }, "value")).toBe("")
        })

        it("converts present values to exact text", () => {
            expect(fieldText({ value: "Alex" }, "value")).toBe("Alex")
            expect(fieldText({ value: "" }, "value")).toBe("")
            expect(fieldText({ value: 42 }, "value")).toBe("42")
            expect(fieldText({ value: 0 }, "value")).toBe("0")
            expect(fieldText({ value: true }, "value")).toBe("true")
            expect(fieldText({ value: false }, "value")).toBe("false")
        })
    })

    describe("fieldNumber", () => {
        it("reads numbers, numeric text and booleans", () => {
            expect(fieldNumber({ value: 42 }, "value")).toBe(42)
            expect(fieldNumber({ value: "12.5" }, "value")).toBe(12.5)
            expect(fieldNumber({ value: -3 }, "value")).toBe(-3)
            expect(fieldNumber({ value: true }, "value")).toBe(1)
        })

        it("uses zero for absent, null, empty, false and unreadable values", () => {
            expect(fieldNumber({}, "missing")).toBe(0)
            expect(fieldNumber({ value: null }, "value")).toBe(0)
            expect(fieldNumber({ value: "" }, "value")).toBe(0)
            expect(fieldNumber({ value: "letters" }, "value")).toBe(0)
            expect(fieldNumber({ value: false }, "value")).toBe(0)
            expect(fieldNumber({ value: 0 }, "value")).toBe(0)
        })
    })
})
