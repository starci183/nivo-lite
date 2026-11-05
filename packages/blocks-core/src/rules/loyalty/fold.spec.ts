import { fold } from "./fold"

describe("fold", () => {
    it("drops accents, folds the Vietnamese d-bar and lower-cases", () => {
        expect(fold("Đồng Bạc")).toBe("dong bac")
        expect(fold("Trà Sữa")).toBe("tra sua")
    })

    it("leaves plain text alone", () => {
        expect(fold("gold-1")).toBe("gold-1")
    })
})
