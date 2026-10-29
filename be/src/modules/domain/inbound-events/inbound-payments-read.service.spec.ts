import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { InboundPaymentsReadService } from "./inbound-payments-read.service"
import { InboundEventEntity } from "./persistence/entities"

const eventOf = entityOf(InboundEventEntity, {
    amountVnd: 500000,
    senderName: "Lan",
    externalRef: null,
    body: "chuyen khoan",
})

const build = async (answers: Parameters<typeof queueQueryBuilders>[1]) => {
    const em = mockEntityManager()
    const fakes = queueQueryBuilders(em, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [InboundPaymentsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(InboundPaymentsReadService), fakes }
}

describe("InboundPaymentsReadService", () => {
    it("tallies the waiting payments and lists the oldest ones with their memo", async () => {
        const { service, fakes } = await build([
            { getRawOne: { count: 2, total: 700000 } },
            { getMany: [eventOf(), eventOf({ amountVnd: null, externalRef: "FT123" })] },
        ])

        await expect(service.unmatched("ws-1", 10)).resolves.toEqual({
            count: 2,
            total: 700000,
            items: [
                { amountVnd: 500000, senderName: "Lan", memo: "chuyen khoan" },
                { amountVnd: 0, senderName: "Lan", memo: "FT123" },
            ],
        })
        expect(fakes[1]?.callsOf("limit")).toEqual([[10]])
    })

    it("answers zeros when the tally returns no row", async () => {
        const { service } = await build([{ getRawOne: undefined }, { getMany: [] }])

        await expect(service.unmatched("ws-1", 10)).resolves.toEqual({ count: 0, total: 0, items: [] })
    })
})
