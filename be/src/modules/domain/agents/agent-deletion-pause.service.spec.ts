import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentDeletionPauseService } from "./agent-deletion-pause.service"
import { AgentEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentDeletionPauseService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AgentDeletionPauseService)
}

describe("AgentDeletionPauseService", () => {
    it("pauses every running agent of the workspace, marked as the deletion's", async () => {
        const em = mockEntityManager({ update: [AgentEntity, { affected: 2 }] })

        await expect((await build(em)).pauseAll("ws-1")).resolves.toBe(2)

        expect(em.update).toHaveBeenCalledWith(
            AgentEntity,
            { workspaceId: "ws-1", status: "active" },
            { status: "paused", pausedByDeletion: true },
        )
    })

    it("answers none paused when the update reports no count", async () => {
        const em = mockEntityManager({ update: [AgentEntity, {}] })

        await expect((await build(em)).pauseAll("ws-1")).resolves.toBe(0)
    })

    it("resumes exactly the agents the deletion paused", async () => {
        const em = mockEntityManager({ update: [AgentEntity, { affected: 2 }] })

        await expect((await build(em)).resumeAll("ws-1")).resolves.toBe(2)

        expect(em.update).toHaveBeenCalledWith(
            AgentEntity,
            { workspaceId: "ws-1", pausedByDeletion: true },
            { status: "active", pausedByDeletion: false },
        )
    })
})
