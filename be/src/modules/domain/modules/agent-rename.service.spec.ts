import { Test } from "@nestjs/testing"
import { installationRecordOf as recordOf } from "@tests/fixtures/builders/module-install.builder"
import { AgentIdentityService } from "@modules/domain/agents"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { mock } from "@starci/jest-preset"
import { AgentRenameService } from "./agent-rename.service"
import { InstallationChangesService } from "./installation-changes.service"

const build = async () => {
    const identity = mock<AgentIdentityService>({ rename: jest.fn(() => Promise.resolve()) })
    const installations = mock<InstallationRecordsService>()
    const changes = mock<InstallationChangesService>({ announceNow: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRenameService,
            { provide: AgentIdentityService, useValue: identity },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: InstallationChangesService, useValue: changes },
        ],
    }).compile()
    return { service: moduleRef.get(AgentRenameService), identity, installations, changes }
}

describe("AgentRenameService", () => {
    it("renames the agent and announces the change of its installation without forcing a sync", async () => {
        const { service, identity, installations, changes } = await build()
        installations.ofAgent.mockResolvedValue(recordOf({ id: "inst-1" }))

        await expect(service.rename("u1", "ws-1", "agent-1", "Mai")).resolves.toBeUndefined()

        expect(identity.rename).toHaveBeenCalledWith("u1", "ws-1", "agent-1", "Mai")
        expect(changes.announceNow).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            installationId: "inst-1",
            force: false,
        })
    })

    it("announces nothing for an agent no installation drives", async () => {
        const { service, installations, changes } = await build()
        installations.ofAgent.mockResolvedValue(null)

        await expect(service.rename("u1", "ws-1", "agent-1", "Mai")).resolves.toBeUndefined()

        expect(changes.announceNow).not.toHaveBeenCalled()
    })
})
