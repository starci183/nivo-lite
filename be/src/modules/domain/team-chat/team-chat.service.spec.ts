import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMemberSeatsService, WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { TeamChatService } from "./team-chat.service"

const build = async () => {
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMemberSeatsService, useValue: mock<WorkspaceMemberSeatsService>() },
            { provide: WorkspaceMembersReadService, useValue: mock<WorkspaceMembersReadService>() },
            { provide: AgentDirectoryService, useValue: mock<AgentDirectoryService>() },
        ],
    }).compile()
    return { service: moduleRef.get(TeamChatService), em }
}

describe("TeamChatService cardRooms", () => {
    it("counts the rooms that hold the approval card of a decision, in this workspace only", async () => {
        const { service, em } = await build()
        const [count] = queueSubQueryBuilders(em, [{ getCount: 2 }])

        await expect(service.cardRooms("w1", "decision-1")).resolves.toBe(2)

        expect(count?.argsOf("where")).toContainEqual([
            "m.workspace_id = :workspaceId AND m.kind = 'approval' AND m.ref->>'decision_id' = :decisionId",
            { workspaceId: "w1", decisionId: "decision-1" },
        ])
    })

    it("answers 0 for a decision no card was posted for", async () => {
        const { service, em } = await build()
        queueSubQueryBuilders(em, [{ getCount: 0 }])
        await expect(service.cardRooms("w1", "decision-9")).resolves.toBe(0)
    })
})
