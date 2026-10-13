import { firstBooleanResult } from "./boolean-result.mapper"

describe("firstBooleanResult", () => {
    it("is true only when the first row's value is exactly true", () => {
        expect(firstBooleanResult([])).toBe(false)
        expect(firstBooleanResult([{ value: false }, { value: true }])).toBe(false)
        expect(firstBooleanResult([{ value: true }])).toBe(true)
    })
})
