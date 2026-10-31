import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentsService } from "@modules/domain/agents"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { EventsService } from "@modules/domain/events"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InstallationChangesService } from "./installation-changes.service"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    INSTALLING_MEMBER as MEMBER,
    installationRecordOf as recordOf,
} from "@tests/fixtures/builders/module-install.builder"
import { AgentRemovalService } from "./agent-removal.service"
import { ModulesErrorCode } from "./errors/modules.error"
import { ModuleReadinessService } from "./module-readiness.service"

/** The agent and version fields of an installation view. */
const VIEWED_AGENT = {
    agentName: "Chatbot",
    agentHandle: "chatbot",
    agentAvatarUrl: null,
    activeVersion: 1,
    setupProgress: { confirmed: 0, total: 8 },
} as const

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const installations = mock<InstallationRecordsService>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const agents = mock<AgentsService>()
    const rules = mock<AuthorityRulesService>()
    const events = mock<EventsService>()
    const sync = mock<InstallationChangesService>()
    const readiness = mock<ModuleReadinessService>()
    readiness.withNeeds.mockImplementation((record) =>
        Promise.resolve({ ...record, ...VIEWED_AGENT, connectionNeeds: [], lifecycle: "removed" }),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRemovalService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentsService, useValue: agents },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: EventsService, useValue: events },
            { provide: InstallationChangesService, useValue: sync },
            { provide: ModuleReadinessService, useValue: readiness },
        ],
    }).compile()
    return { tx, service: moduleRef.get(AgentRemovalService), installations, members, agents, rules, events, sync }
}

describe("AgentRemovalService > remove", () => {
    it("removes the installation, stops its agent and its own grants in one transaction, then queues the sync", async () => {
        const { tx, service, installations, members, agents, rules, events, sync } = await build()
        installations.find
            .mockResolvedValueOnce(recordOf({ isMulti: false }))
            .mockResolvedValueOnce(recordOf({ status: "removed", liveEnabled: false }))
        installations.markRemoved.mockResolvedValue("done")

        await expect(service.remove("u1", "ws-1", "inst-1")).resolves.toMatchObject({
            status: "removed",
            lifecycle: "removed",
        })

        expect(members.require).toHaveBeenCalledWith("u1", "ws-1", ["owner", "manager"])
        expect(installations.markRemoved).toHaveBeenCalledWith("ws-1", "inst-1", MEMBER.displayName, expect.anything())
        expect(agents.setStatus).toHaveBeenCalledWith("u1", "ws-1", "agent-1", false, expect.anything())
        expect(rules.disableForAgent).toHaveBeenCalledWith("ws-1", "agent-1", expect.anything())
        expect(tx.commits).toBe(1)
        expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "module.removed" }))
        expect(sync.announce).toHaveBeenCalledWith(
            { workspaceId: "ws-1", installationId: "inst-1", force: false },
            expect.anything(),
        )
    })

    it("removes an installation that has no agent without touching agents or rules", async () => {
        const { service, installations, agents, rules } = await build()
        installations.find
            .mockResolvedValueOnce(recordOf({ agentId: null, isMulti: true }))
            .mockResolvedValueOnce(recordOf({ agentId: null, status: "removed" }))
        installations.markRemoved.mockResolvedValue("done")

        await service.remove("u1", "ws-1", "inst-1")

        expect(agents.setStatus).not.toHaveBeenCalled()
        expect(rules.disableForAgent).not.toHaveBeenCalled()
    })

    it("changes nothing when the installation is already removed", async () => {
        const { service, installations, events, sync } = await build()
        installations.find.mockResolvedValue(recordOf({ status: "removed" }))

        await expect(service.remove("u1", "ws-1", "inst-1")).resolves.toMatchObject({ lifecycle: "removed" })

        expect(installations.markRemoved).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(sync.announce).not.toHaveBeenCalled()
    })

    it("refuses an installation that is not of the workspace, before or after the removal", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValueOnce(null)
        await expect(service.remove("u1", "ws-1", "inst-9")).rejects.toMatchObject({
            code: ModulesErrorCode.InstallationNotFound,
        })

        installations.find.mockResolvedValueOnce(recordOf()).mockResolvedValueOnce(null)
        installations.markRemoved.mockResolvedValue("done")
        await expect(service.remove("u1", "ws-1", "inst-1")).rejects.toMatchObject({
            code: ModulesErrorCode.InstallationNotFound,
        })
    })
})
