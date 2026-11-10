import { sampleOf } from "../../messages/catalog"
import { plainOf } from "./claims.policy"
import { amountsIn, hasInventedFigure } from "./figures.policy"

describe("claims.policy", () => {
    it("matches a phrase without accents or case", () => {
        expect(plainOf(sampleOf("sampleDaGhiNhanDon"))).toBe("da ghi nhan don")
    })
})

describe("figures.policy", () => {
    it("reads amounts in every written form", () => {
        expect([...amountsIn(sampleOf("sample5Trieu15tr500k200"))].sort((a, b) => a - b)).toEqual(
            [200_000, 500_000, 1_500_000, 5_000_000, 12_345].sort((a, b) => a - b),
        )
    })

    it("flags a discount percentage the documents do not write, and accepts one they do", () => {
        expect(hasInventedFigure(sampleOf("sampleGiam10ChoBan"), sampleOf("sampleGiam10ChoDonDau"))).toBe(false)
        expect(hasInventedFigure(sampleOf("sampleGiam15ChoBan"), sampleOf("sampleGiam10ChoDonDau"))).toBe(true)
        expect(hasInventedFigure(sampleOf("sampleTyLeHaiLong99"), sampleOf("sampleKhongCoSo"))).toBe(false)
    })
})
