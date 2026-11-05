import { fold } from "./fold"

const D_BAR = String.fromCodePoint(0x0110)
const O_HOOK = String.fromCodePoint(0x1ed3)
const A_DOT = String.fromCodePoint(0x1ea1)

describe("fold", () => {
    it("drops accents, folds the Vietnamese d-bar and lower-cases", () => {
        expect(fold(`${D_BAR}${O_HOOK}ng B${A_DOT}c`)).toBe("dong bac")
        expect(fold(`Caf${String.fromCodePoint(0x00e9)} Ba`)).toBe("cafe ba")
    })

    it("leaves plain text alone", () => {
        expect(fold("gold-1")).toBe("gold-1")
    })
})
