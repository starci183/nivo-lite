import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentSyncAdminReadService } from "./agent-sync-admin-read.service"
import { OpenclawAgentSyncEntity } from "./persistence/entities"

const WHEN = new Date("2026-10-02T00:00:00.000Z")

describe("AgentSyncAdminReadService", () => {
    it("reads the sync state of the agents of a workspace, bounded", async () => {
        const sync = Object.assign(new OpenclawAgentSyncEntity(), {
            installationId: "in-1",
            agentId: "ag-1",
            contextVersion: 2,
            checkedAt: WHEN,
            status: "error",
            error: "boom",
        })
        const em = mockEntityManager({ find: [OpenclawAgentSyncEntity, [sync]] })
        const moduleRef = await Test.createTestingModule({
            providers: [AgentSyncAdminReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        await expect(moduleRef.get(AgentSyncAdminReadService).ofWorkspace("ws-1", 50)).resolves.toEqual([
            {
                installationId: "in-1",
                agentId: "ag-1",
                contextVersion: 2,
                checkedAt: WHEN,
                status: "error",
                error: "boom",
            },
        ])
        expect(em.find).toHaveBeenCalledWith(
            OpenclawAgentSyncEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1" }, take: 50 }),
        )
    })
})
