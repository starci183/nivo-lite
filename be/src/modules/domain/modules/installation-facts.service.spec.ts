import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionsService } from "@modules/domain/connections"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { InstallationFactsService } from "./installation-facts.service"

const build = async () => {
    const connections = mock<ConnectionsService>()
    const agents = mock<AgentDirectoryService>()
    const staff = mock<StaffDirectoryService>()
    const members = mock<WorkspaceMembersReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InstallationFactsService,
            { provide: ConnectionsService, useValue: connections },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: StaffDirectoryService, useValue: staff },
            { provide: WorkspaceMembersReadService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(InstallationFactsService), connections, agents, staff, members }
}

describe("InstallationFactsService > requirementFacts", () => {
    it("asks each owner what the workspace has", async () => {
        const { service, connections, agents, staff, members } = await build()
        connections.connectedProviders.mockResolvedValue(["facebook", "instagram"])
        agents.activeCountOfModules.mockResolvedValue(2)
        staff.activeCount.mockResolvedValue(3)
        members.activeCount.mockResolvedValue(9)

        await expect(service.requirementFacts("ws-1")).resolves.toEqual({
            providers: ["facebook", "instagram"],
            chatAgents: 2,
            staff: 3,
            members: 9,
        })
        expect(connections.connectedProviders).toHaveBeenCalledWith("ws-1", 200)
        expect(agents.activeCountOfModules).toHaveBeenCalledWith("ws-1", ["chatbot", "booking"])
        expect(staff.activeCount).toHaveBeenCalledWith("ws-1")
        expect(members.activeCount).toHaveBeenCalledWith("ws-1")
    })
})
