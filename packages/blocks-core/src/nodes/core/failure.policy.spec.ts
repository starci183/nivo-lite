import { failureKindOf } from "./failure.policy"

describe("failureKindOf", () => {
    it("names the class of an error, never its message", () => {
        expect(failureKindOf(new TypeError("secret detail"))).toBe("TypeError")
    })

    it("names the type of anything else a call may reject with", () => {
        expect(failureKindOf("down")).toBe("string")
        expect(failureKindOf(undefined)).toBe("undefined")
    })
})
