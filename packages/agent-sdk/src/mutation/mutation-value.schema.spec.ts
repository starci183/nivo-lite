import { mutationValue, mutationValues } from "./mutation-value.schema"

describe("mutationValue and mutationValues", () => {
    it("parses scalars, null and a bounded object", () => {
        for (const value of ["a", 1, true, null, { a: [1, "b"] }])
            expect(mutationValue.safeParse(value).success).toBe(true)
        expect(mutationValue.safeParse([1]).success).toBe(false)
    })

    it("bounds the number of values", () => {
        const many = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`k${i}`, i]))
        expect(mutationValues.safeParse({ a: 1 }).success).toBe(true)
        expect(mutationValues.safeParse(many).success).toBe(false)
    })
})
