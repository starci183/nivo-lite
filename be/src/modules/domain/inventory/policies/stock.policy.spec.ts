import { Test } from "@nestjs/testing"
import { isSmallAdjustment, stockStatus, suggestOrderQty } from "./stock.policy"

const SUBJECT = Symbol("stock.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isSmallAdjustment, stockStatus, suggestOrderQty } }],
    }).compile()
    return moduleRef.get<
        Pick<typeof import("./stock.policy"), "isSmallAdjustment" | "stockStatus" | "suggestOrderQty">
    >(SUBJECT)
}

describe("stockStatus", () => {
    it("is out when nothing is left", async () => {
        const subject = await buildSubject()

        expect(subject.stockStatus({ reorderPoint: 5, reorderQty: 10 }, 0)).toBe("out")
        expect(subject.stockStatus({ reorderPoint: 5, reorderQty: 10 }, -2)).toBe("out")
    })

    it("is low at or below the reorder point", async () => {
        const subject = await buildSubject()

        expect(subject.stockStatus({ reorderPoint: 5, reorderQty: 10 }, 5)).toBe("low")
        expect(subject.stockStatus({ reorderPoint: 5, reorderQty: 10 }, 3)).toBe("low")
    })

    it("is ok when there is no reorder point to compare with", async () => {
        const subject = await buildSubject()

        expect(subject.stockStatus({ reorderPoint: 0, reorderQty: 0 }, 1000)).toBe("ok")
    })

    it("is over far above the point plus twice the usual order", async () => {
        const subject = await buildSubject()

        expect(subject.stockStatus({ reorderPoint: 5, reorderQty: 10 }, 26)).toBe("over")
        expect(subject.stockStatus({ reorderPoint: 5, reorderQty: 10 }, 25)).toBe("ok")
    })

    it("falls back to the reorder point for the step when there is no usual order", async () => {
        const subject = await buildSubject()

        expect(subject.stockStatus({ reorderPoint: 5, reorderQty: 0 }, 16)).toBe("over")
        expect(subject.stockStatus({ reorderPoint: 5, reorderQty: 0 }, 15)).toBe("ok")
    })
})

describe("suggestOrderQty", () => {
    it("is the usual order quantity when there is one", async () => {
        const subject = await buildSubject()

        expect(subject.suggestOrderQty({ reorderPoint: 5, reorderQty: 12 }, 1)).toBe(12)
    })

    it("reaches twice the reorder point otherwise", async () => {
        const subject = await buildSubject()

        expect(subject.suggestOrderQty({ reorderPoint: 5, reorderQty: 0 }, 2)).toBe(8)
        expect(subject.suggestOrderQty({ reorderPoint: 5, reorderQty: 0 }, -3)).toBe(10)
    })

    it("is never less than one", async () => {
        const subject = await buildSubject()

        expect(subject.suggestOrderQty({ reorderPoint: 1, reorderQty: 0 }, 5)).toBe(1)
    })
})

describe("isSmallAdjustment", () => {
    it("judges by value when the item has a cost", async () => {
        const subject = await buildSubject()

        expect(subject.isSmallAdjustment(-10, 20_000)).toBe(true)
        expect(subject.isSmallAdjustment(11, 20_000)).toBe(false)
    })

    it("judges by units when the item has no cost", async () => {
        const subject = await buildSubject()

        expect(subject.isSmallAdjustment(5, 0)).toBe(true)
        expect(subject.isSmallAdjustment(-6, 0)).toBe(false)
    })
})
