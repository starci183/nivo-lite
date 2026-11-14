import { jsonText } from "./books-shapes"

describe("jsonText", () => {
    it("writes a scalar member as the text it always was", () => {
        expect(jsonText("INV-1")).toBe("INV-1")
        expect(jsonText(42)).toBe("42")
        expect(jsonText(true)).toBe("true")
        expect(jsonText(null)).toBe("null")
        expect(jsonText(undefined)).toBe("undefined")
    })

    it("writes a structure as its JSON, never as [object Object]", () => {
        expect(jsonText({ id: 7 })).toBe('{"id":7}')
        expect(jsonText(["a", 1])).toBe('["a",1]')
    })
})
