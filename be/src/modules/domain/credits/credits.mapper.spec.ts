import { Test } from "@nestjs/testing"
import { toCreditPack, toCreditPackPurchase, toCreditTopupLot } from "./credits.mapper"
import type { PackRow } from "./persistence/credits.rows"

const SUBJECT = Symbol("credits.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toCreditPack, toCreditPackPurchase, toCreditTopupLot } }],
    }).compile()
    return moduleRef.get<typeof import("./credits.mapper")>(SUBJECT)
}

describe("credits mapper", () => {
    it("maps every stored pack column to the catalogue pack", async () => {
        const subject = await buildSubject()

        const row: PackRow = { code: "credits_1000", credits: 1000, price_vnd: 299000, sort: 2 }

        expect(subject.toCreditPack(row)).toEqual({ code: "credits_1000", credits: 1000, priceVnd: 299000, sort: 2 })
    })
})
