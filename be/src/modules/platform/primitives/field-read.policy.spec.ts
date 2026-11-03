import { numberOf, textOf, textOrNull } from "./field-read.policy"

describe("field readers", () => {
    it("reads text, or nothing when the value is not text", () => {
        expect(textOf("a")).toBe("a")
        expect(textOf(3)).toBeUndefined()
        expect(textOrNull("a")).toBe("a")
        expect(textOrNull(null)).toBeNull()
    })

    it.each([
        [12, 12],
        ["12.5", 12.5],
        ["lots", undefined],
        [Number.NaN, undefined],
        [null, undefined],
        [{}, undefined],
    ])("reads %j as the number %s", (value, expected) => {
        expect(numberOf(value)).toBe(expected)
    })
})
