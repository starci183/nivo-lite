import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { InstallationDirectoryService } from "./installation-directory.service"
import { ModulesService } from "./modules.service"

const RECORD: InstallationRecord = {
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "sales",
    name: "Sales",
    isMulti: false,
    agentId: "agent-1",
    agentName: "Lan",
    agentHandle: "lan",
    status: "live",
    operatingMode: "assist",
    liveEnabled: true,
    activeContextVersionId: "ver-1",
    activeVersion: 2,
    settings: { replyTimeoutSec: 30 },
    createdAt: "2026-10-01T00:00:00.000Z",
}

const build = async () => {
    const installations = mock<InstallationRecordsService>()
    const versions = mock<ContextVersionsService>()
    const catalog = mock<ModulesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InstallationDirectoryService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ContextVersionsService, useValue: versions },
            { provide: ModulesService, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(InstallationDirectoryService), installations }
}

describe("InstallationDirectoryService", () => {
    it("answers the installation a workspace reads by id", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(RECORD)

        await expect(service.byId("ws-1", "inst-1")).resolves.toEqual({
            id: "inst-1",
            workspaceId: "ws-1",
            module: "sales",
            name: "Sales",
            isMulti: false,
            agentId: "agent-1",
            operatingMode: "assist",
            settings: { replyTimeoutSec: 30 },
            activeContextVersionId: "ver-1",
        })
    })

    it("answers null when the workspace has no such installation", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(null)

        await expect(service.byId("ws-1", "missing")).resolves.toBeNull()
    })
})
