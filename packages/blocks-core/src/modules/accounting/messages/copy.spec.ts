import en from "./en.json"
import { copyOf, textOf } from "./copy"
import vi from "./vi.json"

describe("accounting messages", () => {
    it("has the same keys in Vietnamese and in English", () => {
        expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort())
    })

    it("keeps every placeholder of the customer confirmation in both languages", () => {
        for (const text of [vi.settle_confirmation, en.settle_confirmation]) {
            expect(text).toContain("{amount}")
            expect(text).toContain("{orderNo}")
        }
    })

    it("names a key as a spec text", () => {
        expect(textOf("adjust")).toEqual({ key: "adjust" })
    })

    it("gives the words of a key in the language asked", () => {
        expect(copyOf("adjust", "vi")).toBe(vi.adjust)
        expect(copyOf("adjust", "en")).toBe(en.adjust)
    })
})
