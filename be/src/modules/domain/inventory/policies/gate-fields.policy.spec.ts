import { fieldNumber, fieldText } from "./gate-fields.policy"

describe("fieldText", () => {
    it("reads a fact as text", () => {
        expect(fieldText({ reason: "count", delta: 4, ok: true }, "reason")).toBe("count")
        expect(fieldText({ delta: 4 }, "delta")).toBe("4")
    })

    it("reads a missing or null fact as the empty text", () => {
        expect(fieldText({ reason: null }, "reason")).toBe("")
        expect(fieldText({}, "reason")).toBe("")
    })
})

describe("fieldNumber", () => {
    it("reads a fact as a number", () => {
        expect(fieldNumber({ delta: -3 }, "delta")).toBe(-3)
        expect(fieldNumber({ delta: "7" }, "delta")).toBe(7)
    })

    it("reads anything else as zero", () => {
        expect(fieldNumber({ delta: "x" }, "delta")).toBe(0)
        expect(fieldNumber({}, "delta")).toBe(0)
    })
})
