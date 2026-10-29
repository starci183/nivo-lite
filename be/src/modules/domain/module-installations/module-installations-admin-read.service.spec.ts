import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ModuleInstallationsAdminReadService } from "./module-installations-admin-read.service"
import { ModuleInstallationEntity } from "./persistence/entities"

const install = (settings: object): ModuleInstallationEntity =>
    Object.assign(new ModuleInstallationEntity(), {
        id: "in-1",
        workspaceId: "ws-1",
        moduleKey: "chatbot",
        status: "ready",
        operatingMode: "assist",
        liveEnabled: true,
        activeContextVersionId: "cv-1",
        settings,
    })

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ModuleInstallationsAdminReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ModuleInstallationsAdminReadService)
}

describe("ModuleInstallationsAdminReadService", () => {
    it("reads the badges of every workspace, bounded", async () => {
        const em = mockEntityManager({ find: [ModuleInstallationEntity, [install({})]] })

        await expect((await build(em)).badges(5000)).resolves.toEqual([
            { workspaceId: "ws-1", moduleKey: "chatbot", status: "ready", liveEnabled: true },
        ])
        expect(em.find).toHaveBeenCalledWith(ModuleInstallationEntity, {
            select: { workspaceId: true, moduleKey: true, status: true, liveEnabled: true },
            take: 5000,
        })
    })

    it("reads the installations of a workspace with the processor setting when it is text", async () => {
        const em = mockEntityManager({
            find: [ModuleInstallationEntity, [install({ processor: "openclaw" }), install({ processor: 3 })]],
        })

        await expect((await build(em)).ofWorkspace("ws-1", 50)).resolves.toEqual([
            {
                id: "in-1",
                moduleKey: "chatbot",
                status: "ready",
                operatingMode: "assist",
                liveEnabled: true,
                activeContextVersionId: "cv-1",
                processor: "openclaw",
            },
            expect.objectContaining({ processor: null }),
        ])
        expect(em.find).toHaveBeenCalledWith(
            ModuleInstallationEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1" }, take: 50 }),
        )
    })
})
