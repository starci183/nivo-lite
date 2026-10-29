import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { OrdersFiguresService } from "./orders-figures.service"
import { OrderEntity } from "./persistence/entities"

const orderOf = entityOf(OrderEntity, {
    id: "o1",
    workspaceId: "ws-1",
    leadId: "l1",
    orderNo: "SO-1",
    items: "2 x tea",
    amountVnd: 200000,
    status: "confirmed",
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [OrdersFiguresService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(OrdersFiguresService)
}

describe("OrdersFiguresService", () => {
    it("counts the orders confirmed inside a window", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getCount: 2 }])
        const from = new Date("2026-10-12T00:00:00.000Z")
        const to = new Date("2026-10-13T00:00:00.000Z")

        await expect((await build(em)).countConfirmedBetween("ws-1", from, to)).resolves.toBe(2)
        expect(fake?.callsOf("where")).toEqual([
            [
                "o.workspaceId = :workspaceId AND o.confirmedAt >= :from AND o.confirmedAt < :to",
                { workspaceId: "ws-1", from, to },
            ],
        ])
    })

    it("lists the confirmed, invoiced and paid orders", async () => {
        const em = mockEntityManager({ find: [OrderEntity, [orderOf()]] })

        await expect((await build(em)).confirmedOrBeyond("ws-1")).resolves.toEqual([
            { id: "o1", leadId: "l1", orderNo: "SO-1", items: "2 x tea", amountVnd: 200000, status: "confirmed" },
        ])
        expect(em.find).toHaveBeenCalledWith(OrderEntity, {
            select: { id: true, leadId: true, orderNo: true, items: true, amountVnd: true, status: true },
            where: { workspaceId: "ws-1", status: In(["confirmed", "invoiced", "paid"]) },
        })
    })
})
