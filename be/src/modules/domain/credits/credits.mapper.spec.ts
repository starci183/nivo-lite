import { toCreditPack } from "./credits.mapper"
import type { PackRow } from "./persistence/credits.rows"

describe("credits mapper", () => {
    it("maps every stored pack column to the catalogue pack", () => {
        const row: PackRow = { code: "credits_1000", credits: 1000, price_vnd: 299000, sort: 2 }

        expect(toCreditPack(row)).toEqual({ code: "credits_1000", credits: 1000, priceVnd: 299000, sort: 2 })
    })
})
