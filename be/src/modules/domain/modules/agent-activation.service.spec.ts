import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentsService } from "@modules/domain/agents"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { installationRecordOf as recordOf } from "@tests/fixtures/builders/module-install.builder"
import { AgentActivationService } from "./agent-activation.service"
import { ModuleInstallService } from "./module-install.service"

const build = async () => {
    const installations = mock<InstallationRecordsService>()
    const installs = mock<ModuleInstallService>()
    const agents = mock<AgentsService>()
    const members = mock<WorkspaceMembersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentActivationService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ModuleInstallService, useValue: installs },
            { provide: AgentsService, useValue: agents },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(AgentActivationService), installations, installs, agents, members }
}

describe("AgentActivationService > setActive", () => {
    it("sends an agent an installation drives through the live switch, so the two never disagree", async () => {
        const { service, installations, installs, agents, members } = await build()
        installations.ofAgent.mockResolvedValue(recordOf())

        await service.setActive("u1", "ws-1", "agent-1", false)

        expect(members.require).toHaveBeenCalledWith("u1", "ws-1", ["owner", "manager"])
        expect(installs.setLive).toHaveBeenCalledWith("u1", "ws-1", "inst-1", false)
        expect(agents.setStatus).not.toHaveBeenCalled()
    })

    it("lets the version guard of the live switch refuse a resume", async () => {
        const { service, installations, installs } = await build()
        const refusal = new Error("needs version")
        installations.ofAgent.mockResolvedValue(recordOf({ activeContextVersionId: null }))
        installs.setLive.mockRejectedValue(refusal)

        await expect(service.setActive("u1", "ws-1", "agent-1", true)).rejects.toBe(refusal)
    })

    it("pauses an agent that no installation drives on its own", async () => {
        const { service, installations, installs, agents } = await build()
        installations.ofAgent.mockResolvedValue(null)

        await service.setActive("u1", "ws-1", "agent-9", false)

        expect(agents.setStatus).toHaveBeenCalledWith("u1", "ws-1", "agent-9", false)
        expect(installs.setLive).not.toHaveBeenCalled()
    })
})
