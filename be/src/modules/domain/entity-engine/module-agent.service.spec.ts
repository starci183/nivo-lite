import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"
import { ModuleAgentService } from "./module-agent.service"

const WS = "11111111-1111-4111-8111-111111111111"

const installationOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: WS,
    moduleKey: "hiring",
    name: "Hiring",
    isMulti: false,
    agentId: "agent-1",
    status: "live",
    operatingMode: "assist",
    liveEnabled: true,
    activeContextVersionId: "version-1",
    settings: {},
    createdAt: "2026-10-01T00:00:00.000Z",
})

const build = async () => {
    const installations = mock<InstallationRecordsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [ModuleAgentService, { provide: InstallationRecordsService, useValue: installations }],
    }).compile()
    return { service: moduleRef.get(ModuleAgentService), installations }
}

const refusal = { code: EntityEngineErrorCode.AgentMissing }

describe("ModuleAgentService", () => {
    it("scopes a write of a module for the agent of its oldest installation, seeing every record of the workspace", async () => {
        const { service, installations } = await build()
        installations.firstOfModule.mockResolvedValue(installationOf())

        await expect(service.scopeOf(WS, "hiring")).resolves.toEqual({ id: "agent-1", sees: "all" })
        expect(installations.firstOfModule).toHaveBeenCalledWith(WS, "hiring")
    })

    it("scopes a write for the agent of the installation a screen carries, not the oldest", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(installationOf({ id: "inst-2", agentId: "agent-2" }))

        await expect(service.scopeOf(WS, "hiring", "inst-2")).resolves.toEqual({ id: "agent-2", sees: "all" })
        expect(installations.find).toHaveBeenCalledWith(WS, "inst-2")
        expect(installations.firstOfModule).not.toHaveBeenCalled()
    })

    it("refuses a write of a module that is not installed in the workspace", async () => {
        const { service, installations } = await build()
        installations.firstOfModule.mockResolvedValue(null)

        await expect(service.scopeOf(WS, "hiring")).rejects.toBeInstanceOf(EntityEngineError)
        await expect(service.scopeOf(WS, "hiring")).rejects.toMatchObject(refusal)
    })

    it("refuses a write for an installation that has no agent bound or was removed", async () => {
        const { service, installations } = await build()
        installations.firstOfModule.mockResolvedValue(installationOf({ agentId: null }))
        await expect(service.scopeOf(WS, "hiring")).rejects.toMatchObject(refusal)

        installations.find.mockResolvedValue(installationOf({ status: "removed" }))
        await expect(service.scopeOf(WS, "hiring", "inst-1")).rejects.toMatchObject(refusal)
    })

    it("refuses a carried installation that belongs to another module or another workspace", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValueOnce(installationOf({ moduleKey: "sales" }))
        await expect(service.scopeOf(WS, "hiring", "inst-1")).rejects.toMatchObject(refusal)

        installations.find.mockResolvedValueOnce(null)
        await expect(service.scopeOf(WS, "hiring", "inst-of-another-workspace")).rejects.toMatchObject(refusal)
    })
})
