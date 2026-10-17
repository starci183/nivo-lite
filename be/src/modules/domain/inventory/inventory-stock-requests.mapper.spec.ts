import { Test } from "@nestjs/testing"
import { toAdjustInventoryStockRequest, toAdjustStockType } from "./inventory-stock-requests.mapper"

const SUBJECT = Symbol("inventory-stock-requests.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toAdjustInventoryStockRequest, toAdjustStockType } }],
    }).compile()
    return moduleRef.get<typeof import("./inventory-stock-requests.mapper")>(SUBJECT)
}

describe("inventory stock requests", () => {
    it("keeps the given location, change and count of an adjustment", async () => {
        const subject = await buildSubject()

        expect(
            subject.toAdjustInventoryStockRequest("ws-1", {
                itemId: "item-1",
                reason: "count",
                locationId: "loc-1",
                delta: -2,
                counted: 8,
            }),
        ).toEqual({
            workspaceId: "ws-1",
            itemId: "item-1",
            reason: "count",
            locationId: "loc-1",
            delta: -2,
            counted: 8,
        })
    })

    it("drops an absent or null location, change and count", async () => {
        const subject = await buildSubject()

        const expected = { workspaceId: "ws-1", itemId: "item-1", reason: "waste" }

        expect(
            subject.toAdjustInventoryStockRequest("ws-1", {
                itemId: "item-1",
                reason: "waste",
                locationId: null,
                delta: null,
                counted: null,
            }),
        ).toEqual(expected)
        expect(subject.toAdjustInventoryStockRequest("ws-1", { itemId: "item-1", reason: "waste" })).toEqual(expected)
    })

    it("answers an applied adjustment with its figures", async () => {
        const subject = await buildSubject()

        expect(subject.toAdjustStockType({ state: "applied", before: 10, after: 8, workItemId: "w-1" })).toEqual({
            state: "applied",
            before: 10,
            after: 8,
            workItemId: "w-1",
        })
    })

    it("writes every absent figure as null", async () => {
        const subject = await buildSubject()

        expect(subject.toAdjustStockType({ state: "waiting" })).toEqual({
            state: "waiting",
            before: null,
            after: null,
            workItemId: null,
        })
    })
})
