import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentsService } from "@modules/domain/agents"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { EventsService } from "@modules/domain/events"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ModuleInstallService } from "./module-install.service"
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
    status: "setup",
    operatingMode: "assist",
    liveEnabled: false,
    activeContextVersionId: null,
    activeVersion: null,
    settings: {},
    createdAt: "2026-10-01T00:00:00.000Z",
}

const build = async () => {
    const installations = mock<InstallationRecordsService>()
    const members = mock<WorkspaceMembersService>()
    const catalog = mock<ModulesService>()
    const agents = mock<AgentsService>()
    const rules = mock<AuthorityRulesService>()
    const events = mock<EventsService>()
    const sync = mock<AgentSyncService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleInstallService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ModulesService, useValue: catalog },
            { provide: AgentsService, useValue: agents },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: EventsService, useValue: events },
            { provide: AgentSyncService, useValue: sync },
        ],
    }).compile()
    return { service: moduleRef.get(ModuleInstallService), installations, members }
}

describe("ModuleInstallService", () => {
    it("lists the installations of a workspace for any member", async () => {
        const { service, installations, members } = await build()
        members.require.mockResolvedValue({
            userId: "owner-1",
            workspaceId: "ws-1",
            role: "owner",
            staffId: null,
            displayName: "Lan",
            status: "active",
        })
        installations.list.mockResolvedValue([RECORD])

        await expect(service.list("owner-1", "ws-1")).resolves.toEqual([RECORD])
    })
})
