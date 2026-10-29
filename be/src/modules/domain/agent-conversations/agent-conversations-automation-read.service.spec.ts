import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { AgentConversationsAutomationReadService } from "./agent-conversations-automation-read.service"

const build = async (answers: ReadonlyArray<QueryBuilderAnswers>) => {
    const entityManager = mockEntityManager()
    const fakes = queueQueryBuilders(entityManager, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentConversationsAutomationReadService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
        ],
    }).compile()
    return { service: moduleRef.get(AgentConversationsAutomationReadService), fakes }
}

describe("AgentConversationsAutomationReadService", () => {
    it("reads one conversation of the workspace", async () => {
        const row = { id: "c1", channel: "zalo" }
        const { service, fakes } = await build([{ getRawOne: row }])

        await expect(service.conversation("ws-1", "c1")).resolves.toBe(row)
        expect(fakes[0]?.callsOf("where")).toEqual([
            [
                "c.workspace_id = :workspaceId AND c.id = :conversationId",
                { workspaceId: "ws-1", conversationId: "c1" },
            ],
        ])
        expect(fakes[0]?.callsOf("limit")).toEqual([[1]])
    })

    it("reads the latest customer conversation of a lead", async () => {
        const row = { id: "c2", channel: "web" }
        const { service, fakes } = await build([{ getRawOne: row }])

        await expect(service.latestOfLead("ws-1", "l1")).resolves.toBe(row)
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["c.created_at", "DESC"]])
        expect(fakes[0]?.callsOf("where")).toEqual([
            [
                "c.workspace_id = :workspaceId AND c.lead_id = :leadId AND c.kind = 'customer'",
                { workspaceId: "ws-1", leadId: "l1" },
            ],
        ])
    })

    it("lists the leads that have a real conversation, bounded", async () => {
        const { service, fakes } = await build([{ getRawMany: [{ lead_id: "l1" }] }])

        await expect(service.leadsWithChat("ws-1", ["l1", "l2"])).resolves.toEqual([{ lead_id: "l1" }])
        expect(fakes[0]?.callsOf("limit")).toEqual([[500]])
        expect(fakes[0]?.callsOf("where")).toEqual([
            [
                "c.workspace_id = :workspaceId AND c.kind = 'customer' AND c.lead_id = ANY(:leadIds::uuid[])",
                { workspaceId: "ws-1", leadIds: ["l1", "l2"] },
            ],
        ])
    })
})
