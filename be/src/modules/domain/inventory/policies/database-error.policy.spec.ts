import { isUniqueViolation } from "./database-error.policy"

describe("isUniqueViolation", () => {
    it("is true for a driver failure with the unique-violation code", () => {
        expect(isUniqueViolation(Object.assign(new Error("duplicate key"), { code: "23505" }))).toBe(true)
    })

    it("is false for any other code, an error without one and anything that is not an object", () => {
        expect(isUniqueViolation(Object.assign(new Error("other"), { code: "23503" }))).toBe(false)
        expect(isUniqueViolation(new Error("plain"))).toBe(false)
        expect(isUniqueViolation(null)).toBe(false)
        expect(isUniqueViolation("23505")).toBe(false)
    })
})
