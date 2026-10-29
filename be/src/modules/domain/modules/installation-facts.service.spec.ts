import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionsService } from "@modules/domain/connections"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { AgentSyncReadService } from "@modules/domain/openclaw-agent-sync"
import type { SyncCopy } from "@modules/domain/openclaw-agent-sync"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { InstallationFactsService } from "./installation-facts.service"

const recordOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "chatbot",
    name: "Front desk",
    isMulti: true,
    agentId: "agent-1",
    status: "live",
    operatingMode: "assist",
    liveEnabled: true,
    activeContextVersionId: "version-1",
    settings: {},
    createdAt: "2026-10-01T00:00:00.000Z",
})

const copyOf = builder<SyncCopy>({
    status: "ok",
    contextVersion: 1,
    checkedAt: new Date("2026-10-02T00:00:00.000Z"),
    error: null,
})

const build = async () => {
    const installations = mock<InstallationRecordsService>()
    const versions = mock<ContextVersionsService>()
    const copies = mock<AgentSyncReadService>()
    const connections = mock<ConnectionsService>()
    const agents = mock<AgentDirectoryService>()
    const staff = mock<StaffDirectoryService>()
    const members = mock<WorkspaceMembersReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InstallationFactsService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ContextVersionsService, useValue: versions },
            { provide: AgentSyncReadService, useValue: copies },
            { provide: ConnectionsService, useValue: connections },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: StaffDirectoryService, useValue: staff },
            { provide: WorkspaceMembersReadService, useValue: members },
        ],
    }).compile()
    return {
        service: moduleRef.get(InstallationFactsService),
        installations,
        versions,
        copies,
        connections,
        agents,
        staff,
        members,
    }
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

describe("InstallationFactsService > syncStatus", () => {
    it.each(["ok", "error"] as const)(
        "keeps the known state %s of the copy against the active version",
        async (status) => {
            const { service, installations, versions, copies } = await build()
            installations.find.mockResolvedValue(recordOf())
            versions.numbersOf.mockResolvedValue([{ id: "version-1", version: 2 }])
            copies.copyOf.mockResolvedValue(copyOf({ status, error: status === "error" ? "gateway down" : null }))

            await expect(service.syncStatus("ws-1", "inst-1")).resolves.toEqual({
                state: status,
                syncedVersion: 1,
                activeVersion: 2,
                checkedAt: "2026-10-02T00:00:00.000Z",
                error: status === "error" ? "gateway down" : null,
            })
            expect(installations.find).toHaveBeenCalledWith("ws-1", "inst-1")
            expect(versions.numbersOf).toHaveBeenCalledWith(["version-1"])
            expect(copies.copyOf).toHaveBeenCalledWith("inst-1")
        },
    )

    it("reads an installation without a copy or an applied version as none", async () => {
        const { service, installations, versions, copies } = await build()
        installations.find.mockResolvedValue(recordOf({ activeContextVersionId: null }))
        versions.numbersOf.mockResolvedValue([])
        copies.copyOf.mockResolvedValue(null)

        await expect(service.syncStatus("ws-1", "inst-1")).resolves.toEqual({
            state: "none",
            syncedVersion: null,
            activeVersion: null,
            checkedAt: null,
            error: null,
        })
        expect(versions.numbersOf).toHaveBeenCalledWith([])
    })

    it("answers null for an installation of another workspace", async () => {
        const { service, installations, copies } = await build()
        installations.find.mockResolvedValue(null)

        await expect(service.syncStatus("ws-2", "inst-1")).resolves.toBeNull()
        expect(copies.copyOf).not.toHaveBeenCalled()
    })
})
