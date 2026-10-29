import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PaymentOrderHistoryService } from "./payment-order-history.service"
import { PaymentOrderEntity } from "./persistence/entities"

const reading = async (answers: QueryBuilderAnswers) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder(answers)
    em.createQueryBuilder.mockReturnValue(fake.builder)
    const moduleRef = await Test.createTestingModule({
        providers: [PaymentOrderHistoryService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(PaymentOrderHistoryService), em, fake }
}

describe("PaymentOrderHistoryService > planPaymentsOf", () => {
    it("counts the paid plan orders at full price and at the intro price", async () => {
        const { service, em, fake } = await reading({ getRawOne: { full_price: 2, promo: 1 } })

        await expect(service.planPaymentsOf("ws")).resolves.toEqual({ fullPrice: 2, promo: 1 })
        expect(em.createQueryBuilder).toHaveBeenCalledWith(PaymentOrderEntity, "o")
        expect(fake.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws" })
    })

    it("counts nothing for a workspace with no paid plan order", async () => {
        const { service } = await reading({ getRawOne: undefined })

        await expect(service.planPaymentsOf("ws")).resolves.toEqual({ fullPrice: 0, promo: 0 })
    })
})
