import { Test } from "@nestjs/testing"
import { itemLinesOf, itemsTextOf } from "./order-items.policy"

const SUBJECT = Symbol("order-items.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { itemLinesOf, itemsTextOf } }],
    }).compile()
    return moduleRef.get<typeof import("./order-items.policy")>(SUBJECT)
}

describe("order items policy", () => {
    it("writes the lines as quantity times name", async () => {
        const subject = await buildSubject()
        const lines = [
            { name: "tea", qty: 2, unitPriceVnd: 5, catalogueItemId: "c1" },
            { name: "cake", qty: 1 },
        ]

        expect(subject.itemsTextOf(lines)).toBe("2 x tea, 1 x cake")
    })

    it("reads the lines back and counts a part without a quantity once", async () => {
        const subject = await buildSubject()

        expect(subject.itemLinesOf("2 x tea, 1.5 x rice, plain cake, ")).toEqual([
            { name: "tea", qty: 2 },
            { name: "rice", qty: 1.5 },
            { name: "plain cake", qty: 1 },
        ])
        expect(subject.itemLinesOf("")).toEqual([])
    })
})
