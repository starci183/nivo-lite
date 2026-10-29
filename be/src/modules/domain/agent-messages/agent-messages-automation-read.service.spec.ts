import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { AgentMessagesAutomationReadService } from "./agent-messages-automation-read.service"

describe("AgentMessagesAutomationReadService", () => {
    it("reads the newest line the customer wrote in a conversation", async () => {
        const entityManager = mockEntityManager()
        const row = { created_at: "2026-10-12T03:00:00.000Z" }
        const [fake] = queueQueryBuilders(entityManager, [{ getRawOne: row }])
        const moduleRef = await Test.createTestingModule({
            providers: [
                AgentMessagesAutomationReadService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            ],
        }).compile()

        await expect(moduleRef.get(AgentMessagesAutomationReadService).lastCustomerMessage("c1")).resolves.toBe(row)
        expect(fake?.callsOf("where")).toEqual([
            ["m.conversation_id = :conversationId AND m.role = 'user'", { conversationId: "c1" }],
        ])
        expect(fake?.callsOf("orderBy")).toEqual([["m.created_at", "DESC"]])
    })
})
