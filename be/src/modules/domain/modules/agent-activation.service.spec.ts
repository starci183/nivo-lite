import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentBindingsService, AgentConnectionsError, AgentConnectionsErrorCode } from "@modules/domain/agent-connections"
import { AgentDirectoryService, AgentsService } from "@modules/domain/agents"
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
    const bindings = mock<AgentBindingsService>()
    bindings.requireResumeChoice.mockResolvedValue([])
    const directory = mock<AgentDirectoryService>()
    directory.cardsOf.mockResolvedValue([{ id: "agent-1", name: "Minh", module: "sales", canTagAgentIds: [] }])
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentActivationService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ModuleInstallService, useValue: installs },
            { provide: AgentsService, useValue: agents },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: AgentDirectoryService, useValue: directory },
        ],
    }).compile()
    return { service: moduleRef.get(AgentActivationService), installations, installs, agents, members, bindings, directory }
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

describe("AgentActivationService > resuming with channels", () => {
    const CONFLICT = {
        connectionId: "c1",
        connectionName: "Shop bot",
        owner: {
            connectionId: "c1",
            agentId: "agent-lan",
            agentName: "Lan",
            module: "sales",
            purpose: "outbound_chat" as const,
            access: "ask" as const,
            grantedAt: new Date("2026-11-01T00:00:00.000Z"),
        },
    }

    it("checks the channels of the role before it resumes, and does not resume when the check refuses", async () => {
        const { service, installations, installs, bindings } = await build()
        installations.ofAgent.mockResolvedValue(recordOf())
        const conflict = new AgentConnectionsError({
            code: AgentConnectionsErrorCode.ResumeConflict,
            params: { agent: "Minh", channels: "Shop bot", owners: "Lan" },
        })
        bindings.requireResumeChoice.mockRejectedValue(conflict)

        await expect(service.setActive("u1", "ws-1", "agent-1", true)).rejects.toBe(conflict)

        expect(bindings.requireResumeChoice).toHaveBeenCalledWith(
            "ws-1",
            { id: "agent-1", name: "Minh", module: "sales", canTagAgentIds: [] },
            null,
        )
        expect(installs.setLive).not.toHaveBeenCalled()
    })

    it("resumes with the choice and settles the conflicts afterwards, so a refused resume drops nothing", async () => {
        const { service, installations, installs, bindings } = await build()
        installations.ofAgent.mockResolvedValue(recordOf())
        bindings.requireResumeChoice.mockResolvedValue([CONFLICT])

        await service.setActive("u1", "ws-1", "agent-1", true, "current")

        expect(bindings.requireResumeChoice).toHaveBeenCalledWith("ws-1", expect.anything(), "current")
        expect(installs.setLive).toHaveBeenCalledWith("u1", "ws-1", "inst-1", true)
        expect(bindings.settleResume).toHaveBeenCalledWith("ws-1", "agent-1", [CONFLICT], "current")
        expect(installs.setLive.mock.invocationCallOrder[0]).toBeLessThan(
            bindings.settleResume.mock.invocationCallOrder[0] ?? 0,
        )
    })

    it("keeps the resumed agent when asked, for an agent no installation drives", async () => {
        const { service, installations, agents, bindings } = await build()
        installations.ofAgent.mockResolvedValue(null)
        bindings.requireResumeChoice.mockResolvedValue([CONFLICT])

        await service.setActive("u1", "ws-1", "agent-1", true, "resumed")

        expect(agents.setStatus).toHaveBeenCalledWith("u1", "ws-1", "agent-1", true)
        expect(bindings.settleResume).toHaveBeenCalledWith("ws-1", "agent-1", [CONFLICT], "resumed")
    })

    it("asks nothing of the channels when pausing", async () => {
        const { service, installations, bindings, directory } = await build()
        installations.ofAgent.mockResolvedValue(recordOf())

        await service.setActive("u1", "ws-1", "agent-1", false)

        expect(directory.cardsOf).not.toHaveBeenCalled()
        expect(bindings.requireResumeChoice).not.toHaveBeenCalled()
    })
})

describe("AgentActivationService > setInstallationLive (the agent page switch)", () => {
    it("refuses to resume into a channel two agents of the role would answer, before the switch", async () => {
        const { service, installations, installs, bindings } = await build()
        installations.find.mockResolvedValue(recordOf())
        const conflict = new AgentConnectionsError({ code: AgentConnectionsErrorCode.ResumeConflict })
        bindings.requireResumeChoice.mockRejectedValue(conflict)

        await expect(service.setInstallationLive("u1", "ws-1", "inst-1", true)).rejects.toBe(conflict)

        expect(installs.setLive).not.toHaveBeenCalled()
    })

    it("resumes with the choice, settles the channels and answers the installation", async () => {
        const { service, installations, installs, bindings, members } = await build()
        installations.find.mockResolvedValue(recordOf())
        bindings.requireResumeChoice.mockResolvedValue([])
        installs.setLive.mockResolvedValue({ id: "inst-1" } as never)

        await expect(service.setInstallationLive("u1", "ws-1", "inst-1", true, "resumed")).resolves.toEqual({
            id: "inst-1",
        })

        expect(members.require).toHaveBeenCalledWith("u1", "ws-1", ["owner", "manager"])
        expect(bindings.requireResumeChoice).toHaveBeenCalledWith("ws-1", expect.anything(), "resumed")
        expect(installs.setLive).toHaveBeenCalledWith("u1", "ws-1", "inst-1", true)
        expect(bindings.settleResume).toHaveBeenCalledWith("ws-1", "agent-1", [], "resumed")
    })

    it("pauses without looking at the channels", async () => {
        const { service, installations, installs, bindings } = await build()
        installations.find.mockResolvedValue(recordOf())

        await service.setInstallationLive("u1", "ws-1", "inst-1", false)

        expect(bindings.requireResumeChoice).not.toHaveBeenCalled()
        expect(installs.setLive).toHaveBeenCalledWith("u1", "ws-1", "inst-1", false)
    })
})
