import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { OrdersAutomationReadService } from "./orders-automation-read.service"

const build = async (answers: ReadonlyArray<QueryBuilderAnswers>) => {
    const entityManager = mockEntityManager()
    const fakes = queueQueryBuilders(entityManager, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [OrdersAutomationReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(OrdersAutomationReadService), fakes, entityManager }
}

describe("OrdersAutomationReadService", () => {
    it("reads one order of the workspace", async () => {
        const row = { id: "o1", order_no: "DH-1" }
        const { service, fakes } = await build([{ getRawOne: row }])

        await expect(service.order("ws-1", "o1")).resolves.toBe(row)
        expect(fakes[0]?.callsOf("where")).toEqual([
            ["o.workspace_id = :workspaceId AND o.id = :orderId", { workspaceId: "ws-1", orderId: "o1" }],
        ])
        expect(fakes[0]?.callsOf("limit")).toEqual([[1]])
    })

    it("counts and totals the confirmed orders, zero when nothing answers", async () => {
        const { service, entityManager } = await build([
            { getRawOne: { count: 2, total: "500000" } },
            { getRawOne: undefined },
        ])

        await expect(service.confirmedSince("ws-1", "2026-10-12", entityManager)).resolves.toEqual({
            count: 2,
            total: "500000",
        })
        await expect(service.confirmedSince("ws-1", "2026-10-12", entityManager)).resolves.toEqual({
            count: 0,
            total: 0,
        })
    })
})
