import { bearerTokenOf } from "./tool-bearer.policy"

describe("bearerTokenOf", () => {
    it("takes the token after the Bearer scheme in any case", () => {
        expect(bearerTokenOf("Bearer abc.def")).toBe("abc.def")
        expect(bearerTokenOf("bearer   xyz  ")).toBe("xyz")
    })

    it("answers an empty text for a missing header or another scheme", () => {
        expect(bearerTokenOf(undefined)).toBe("")
        expect(bearerTokenOf("Basic abc")).toBe("")
        expect(bearerTokenOf("Bearer")).toBe("")
    })
})
