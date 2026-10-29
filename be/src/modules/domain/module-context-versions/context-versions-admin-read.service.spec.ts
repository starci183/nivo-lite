import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContextVersionsAdminReadService } from "./context-versions-admin-read.service"
import { ModuleContextVersionEntity } from "./persistence/entities"

const WHEN = new Date("2026-10-02T00:00:00.000Z")

describe("ContextVersionsAdminReadService", () => {
    it("reads the context versions of a workspace, bounded", async () => {
        const version = Object.assign(new ModuleContextVersionEntity(), { id: "v-1", version: 3, appliedAt: WHEN })
        const em = mockEntityManager({ find: [ModuleContextVersionEntity, [version]] })
        const moduleRef = await Test.createTestingModule({
            providers: [ContextVersionsAdminReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        await expect(moduleRef.get(ContextVersionsAdminReadService).ofWorkspace("ws-1", 500)).resolves.toEqual([
            { id: "v-1", version: 3, appliedAt: WHEN },
        ])
        expect(em.find).toHaveBeenCalledWith(ModuleContextVersionEntity, {
            select: { id: true, version: true, appliedAt: true },
            where: { workspaceId: "ws-1" },
            take: 500,
        })
    })
})
