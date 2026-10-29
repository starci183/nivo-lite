import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { OrdersLabelReadService } from "./orders-label-read.service"
import { OrderEntity } from "./persistence/entities"

describe("OrdersLabelReadService", () => {
    it("names the number of each order, nothing for no orders", async () => {
        const em = mockEntityManager({ find: [OrderEntity, [entityOf(OrderEntity, { id: "o-1", orderNo: "DH-1" })()]] })
        const moduleRef = await Test.createTestingModule({
            providers: [OrdersLabelReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()
        const service = moduleRef.get(OrdersLabelReadService)

        await expect(service.numbersOf("ws-1", [])).resolves.toEqual([])
        await expect(service.numbersOf("ws-1", ["o-1", "o-1"])).resolves.toEqual([{ id: "o-1", orderNo: "DH-1" }])
        expect(em.find).toHaveBeenCalledTimes(1)
    })

    it("summarises each order, with a null amount staying null, nothing for no orders", async () => {
        const order = entityOf(OrderEntity, {
            id: "o-1",
            orderNo: "DH-1",
            items: "tea",
            amountVnd: 5000,
            status: "confirmed",
        })
        const em = mockEntityManager({ find: [OrderEntity, [order(), order({ id: "o-2", amountVnd: null })]] })
        const moduleRef = await Test.createTestingModule({
            providers: [OrdersLabelReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()
        const service = moduleRef.get(OrdersLabelReadService)

        await expect(service.summariesOf("ws-1", [])).resolves.toEqual([])
        await expect(service.summariesOf("ws-1", ["o-1", "o-2"])).resolves.toEqual([
            { id: "o-1", orderNo: "DH-1", items: "tea", amountVnd: 5000, status: "confirmed" },
            { id: "o-2", orderNo: "DH-1", items: "tea", amountVnd: null, status: "confirmed" },
        ])
    })
})
