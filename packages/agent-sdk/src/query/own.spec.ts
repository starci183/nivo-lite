import { ownEntry } from "./own"

describe("ownEntry", () => {
    it("returns the value under an own key", () => {
        expect(ownEntry({ a: 1 }, "a")).toBe(1)
    })

    it("returns undefined for a missing key", () => {
        expect(ownEntry({ a: 1 }, "b")).toBeUndefined()
    })

    it("never reaches the prototype", () => {
        expect(ownEntry({ a: 1 }, "constructor")).toBeUndefined()
        expect(ownEntry({ a: 1 }, "__proto__")).toBeUndefined()
    })
})
