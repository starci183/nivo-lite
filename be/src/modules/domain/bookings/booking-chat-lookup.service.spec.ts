import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingChatLookupService } from "./booking-chat-lookup.service"
import type { CancellableFacts } from "./booking-facts.contracts"
import { BookingEntity } from "./persistence/entities"

const WORKSPACE = "ws-1"
const CONVERSATION = "conversation-1"
const NOW = Date.UTC(2026, 9, 11, 5, 0)
const MONDAY_NINE = "2026-10-12T02:00:00.000Z"
const NEXT_ROW: CancellableFacts = {
    id: "b-next",
    lead_id: "lead-1",
    customer_name: "Mai",
    service_name: "Cut",
    start_ms: Date.parse(MONDAY_NINE),
}

const build = async (row?: CancellableFacts) => {
    const entityManager = mockEntityManager()
    const fake = fakeQueryBuilder({ getRawOne: row })
    entityManager.createQueryBuilder.mockReturnValue(fake.builder)
    const moduleRef = await Test.createTestingModule({
        providers: [BookingChatLookupService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(BookingChatLookupService), entityManager, fake }
}

describe("BookingChatLookupService", () => {
    describe("nextOfChat", () => {
        it.each(["lead-1", null])("maps the next booking for a chat with lead %s", async (leadId) => {
            const { service, entityManager, fake } = await build({ ...NEXT_ROW, lead_id: leadId })
            await expect(
                service.nextOfChat({ workspaceId: WORKSPACE, leadId, conversationId: CONVERSATION }, NOW),
            ).resolves.toEqual({
                id: "b-next",
                leadId,
                customerName: "Mai",
                serviceName: "Cut",
                startIso: MONDAY_NINE,
            })
            expect(entityManager.createQueryBuilder).toHaveBeenCalledWith(BookingEntity, "b")
            expect(fake.callsOf("where")).toEqual([["b.workspaceId = :workspaceId", { workspaceId: WORKSPACE }]])
            expect(fake.callsOf("andWhere")[0]?.[1]).toEqual({ leadId, conversationId: CONVERSATION })
            expect(fake.callsOf("andWhere")[2]).toEqual(["b.startAt > :now", { now: new Date(NOW) }])
            expect(fake.callsOf("limit")).toEqual([[1]])
            expect(entityManager.createQueryBuilder).toHaveBeenCalledTimes(1)
        })

        it("answers null when the chat has no open future booking", async () => {
            const { service, entityManager } = await build()
            await expect(
                service.nextOfChat({ workspaceId: WORKSPACE, leadId: "lead-1", conversationId: CONVERSATION }, NOW),
            ).resolves.toBeNull()
            expect(entityManager.createQueryBuilder).toHaveBeenCalledTimes(1)
        })
    })
})
