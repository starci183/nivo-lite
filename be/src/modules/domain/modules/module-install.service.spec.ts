import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentIdentityService, AgentsService } from "@modules/domain/agents"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { EventsService } from "@modules/domain/events"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InstallationChangesService } from "./installation-changes.service"
import { InstallationFactsService } from "./installation-facts.service"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ACCOUNTING_MODULE } from "./accounting.contracts"
import { CHATBOT_MODULE } from "./chatbot.contracts"
import { ModulesErrorCode } from "./errors/modules.error"
import { ModuleInstallService } from "./module-install.service"
import { ModuleReadinessService } from "./module-readiness.service"
import { ModulesService } from "./modules.service"
import { RecordInstallationService } from "./record-installation.service"
import {
    INSTALLING_MEMBER as MEMBER,
    installAgentOf as agentOf,
    installationRecordOf as recordOf,
} from "@tests/fixtures/builders/module-install.builder"
import {
    INSTALL_VIEWED as VIEWED,
    installRequestOf as requestOf,
    SYNCED_AGENT_COPY,
} from "@tests/fixtures/builders/module-install-service.builder"

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const installations = mock<InstallationRecordsService>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const catalog = mock<ModulesService>()
    catalog.find.mockResolvedValue(CHATBOT_MODULE)
    const agents = mock<AgentsService>()
    const identity = mock<AgentIdentityService>()
    const rules = mock<AuthorityRulesService>()
    const events = mock<EventsService>()
    const sync = mock<InstallationChangesService>()
    const facts = mock<InstallationFactsService>()
    const recordOwners = mock<RecordInstallationService>()
    const readiness = mock<ModuleReadinessService>()
    readiness.needsOf.mockResolvedValue([])
    readiness.withNeeds.mockImplementation((record) => Promise.resolve({ ...record, ...VIEWED }))
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleInstallService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ModulesService, useValue: catalog },
            { provide: AgentsService, useValue: agents },
            { provide: AgentIdentityService, useValue: identity },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: EventsService, useValue: events },
            { provide: InstallationChangesService, useValue: sync },
            { provide: InstallationFactsService, useValue: facts },
            { provide: RecordInstallationService, useValue: recordOwners },
            { provide: ModuleReadinessService, useValue: readiness },
        ],
    }).compile()
    const service = moduleRef.get(ModuleInstallService)
    return {
        tx,
        service,
        installations,
        members,
        catalog,
        agents,
        identity,
        rules,
        events,
        sync,
        readiness,
        facts,
        recordOwners,
    }
}

describe("ModuleInstallService > install", () => {
    it("refuses a blank instance name", async () => {
        const { service } = await build()

        await expect(service.install("u1", requestOf({ name: "   " }))).rejects.toMatchObject({
            code: ModulesErrorCode.InstanceNameInvalid,
        })
    })

    it("refuses a second instance of a type that allows one", async () => {
        const { service, catalog } = await build()
        catalog.find.mockResolvedValue(ACCOUNTING_MODULE)

        await expect(
            service.install("u1", requestOf({ moduleKey: "accounting", newInstance: true })),
        ).rejects.toMatchObject({ code: ModulesErrorCode.SingleInstanceOnly })
    })

    it("answers the installation the type already has, and still seeds its rules and its sync", async () => {
        const { service, installations, rules, sync } = await build()
        installations.firstOfModule.mockResolvedValue(recordOf())

        await expect(service.install("u1", requestOf())).resolves.toEqual({
            installationId: "inst-1",
            agentId: "agent-1",
            created: false,
        })
        expect(installations.insert).not.toHaveBeenCalled()
        expect(rules.seedDefaults).toHaveBeenCalledWith("ws-1", "chatbot", expect.any(Array))
        expect(sync.announceNow).toHaveBeenCalledWith({ workspaceId: "ws-1", installationId: "inst-1", force: true })
    })

    it("installs the first instance on an agent no installation drives yet", async () => {
        const { service, installations, agents, events } = await build()
        installations.firstOfModule.mockResolvedValue(null)
        installations.instanceNames.mockResolvedValue([])
        installations.boundAgentIds.mockResolvedValue(["agent-1"])
        agents.list.mockResolvedValue([agentOf(), agentOf({ id: "agent-2" })])
        installations.insert.mockResolvedValue("inst-2")

        await expect(service.install("u1", requestOf())).resolves.toEqual({
            installationId: "inst-2",
            agentId: "agent-2",
            created: true,
        })
        expect(agents.create).not.toHaveBeenCalled()
        expect(installations.insert).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            moduleKey: "chatbot",
            name: CHATBOT_MODULE.name.en,
            agentId: "agent-2",
            operatingMode: "assist",
        })
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "module.installed",
            actor: "Lan",
            summary: `Lan: ${CHATBOT_MODULE.name.en}`,
        })
    })
})

describe("ModuleInstallService > install, named instances", () => {
    it("adds a named instance on a new agent with a free handle", async () => {
        const { service, installations, agents, events } = await build()
        installations.instanceNames.mockResolvedValue([{ id: "inst-1", name: CHATBOT_MODULE.name.en }])
        agents.list.mockResolvedValue([agentOf()])
        agents.create.mockResolvedValue(agentOf({ id: "agent-9" }))
        installations.insert.mockResolvedValue("inst-9")

        await expect(service.install("u1", requestOf({ newInstance: true, name: "  Night   desk " }))).resolves.toEqual(
            { installationId: "inst-9", agentId: "agent-9", created: true },
        )
        expect(agents.create).toHaveBeenCalledWith("u1", {
            workspaceId: "ws-1",
            module: "chatbot",
            name: "Night desk",
            handle: `${CHATBOT_MODULE.agent.handle}-2`,
            role: CHATBOT_MODULE.agent.role.en,
            instructions: CHATBOT_MODULE.agent.instructions.en,
        })
        expect(events.record).toHaveBeenCalledWith(
            expect.objectContaining({ summary: `Lan: ${CHATBOT_MODULE.name.en} - Night desk` }),
        )
    })

    it("refuses an instance name the type already uses", async () => {
        const { service, installations } = await build()
        installations.instanceNames.mockResolvedValue([{ id: "inst-1", name: "Night desk" }])

        await expect(service.install("u1", requestOf({ newInstance: true, name: "night DESK" }))).rejects.toMatchObject(
            { code: ModulesErrorCode.InstanceNameTaken },
        )
    })

    it("answers the installation another tab created when it lost the race", async () => {
        const { service, installations, agents } = await build()
        installations.firstOfModule.mockResolvedValueOnce(null).mockResolvedValueOnce(recordOf({ id: "inst-3" }))
        installations.instanceNames.mockResolvedValue([])
        installations.boundAgentIds.mockResolvedValue([])
        agents.list.mockResolvedValue([agentOf()])
        installations.insert.mockResolvedValue(null)

        await expect(service.install("u1", requestOf())).resolves.toEqual({
            installationId: "inst-3",
            agentId: "agent-1",
            created: false,
        })
    })

    it("reports the name taken when an added instance lost the race", async () => {
        const { service, installations, agents } = await build()
        installations.instanceNames.mockResolvedValue([])
        agents.list.mockResolvedValue([])
        agents.create.mockResolvedValue(agentOf({ id: "agent-9" }))
        installations.insert.mockResolvedValue(null)

        await expect(service.install("u1", requestOf({ newInstance: true }))).rejects.toMatchObject({
            code: ModulesErrorCode.InstanceNameTaken,
        })
    })
})

describe("ModuleInstallService > rename", () => {
    it("refuses a name a sibling instance holds", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(recordOf())
        installations.instanceNames.mockResolvedValue([{ id: "inst-2", name: "Night desk" }])

        await expect(service.rename("u1", "ws-1", "inst-1", "NIGHT desk")).rejects.toMatchObject({
            code: ModulesErrorCode.InstanceNameTaken,
        })
    })

    it("renames the instance and answers it read back", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValueOnce(recordOf()).mockResolvedValueOnce(recordOf({ name: "Lobby" }))
        installations.instanceNames.mockResolvedValue([])
        installations.rename.mockResolvedValue("done")

        await expect(service.rename("u1", "ws-1", "inst-1", " Lobby ")).resolves.toEqual({
            ...recordOf({ name: "Lobby" }),
            ...VIEWED,
        })
        expect(installations.rename).toHaveBeenCalledWith("ws-1", "inst-1", "Lobby")
    })

    it("refuses an installation the write did not find", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(recordOf())
        installations.instanceNames.mockResolvedValue([])
        installations.rename.mockResolvedValue("missing")

        await expect(service.rename("u1", "ws-1", "inst-1", "Lobby")).rejects.toMatchObject({
            code: ModulesErrorCode.InstallationNotFound,
        })
    })
})

describe("ModuleInstallService > setLive", () => {
    it.each([
        [{ activeContextVersionId: null }, ModulesErrorCode.NeedsVersion],
        [{ status: "removed" }, ModulesErrorCode.InstallationRemoved],
    ] as const)("refuses to go live for %o", async (patch, code) => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(recordOf(patch))
        await expect(service.setLive("u1", "ws-1", "inst-1", true)).rejects.toMatchObject({ code })
    })

    it("switches the installation and its agent live", async () => {
        const { service, installations, agents } = await build()
        installations.find.mockResolvedValueOnce(recordOf()).mockResolvedValueOnce(recordOf({ liveEnabled: true }))
        installations.setLive.mockResolvedValue("done")

        await expect(service.setLive("u1", "ws-1", "inst-1", true)).resolves.toEqual({
            ...recordOf({ liveEnabled: true }),
            ...VIEWED,
        })
        expect(agents.setStatus).toHaveBeenCalledWith("u1", "ws-1", "agent-1", true, expect.anything())
        expect(installations.setLive).toHaveBeenCalledWith("ws-1", "inst-1", true, false, expect.anything())
    })

    it("records needs_connection, not live, when a required connection is missing", async () => {
        const { service, installations, readiness } = await build()
        installations.find.mockResolvedValue(recordOf())
        readiness.needsOf.mockResolvedValue([{ role: "invoice.list", providers: ["misa"] }])
        installations.setLive.mockResolvedValue("done")
        await service.setLive("u1", "ws-1", "inst-1", true)
        expect(installations.setLive).toHaveBeenCalledWith("ws-1", "inst-1", true, true, expect.anything())
    })
})

describe("ModuleInstallService > renameAgent", () => {
    it("refuses a name shorter than the limit", async () => {
        const { service } = await build()

        await expect(service.renameAgent("u1", "ws-1", "inst-1", " A ")).rejects.toMatchObject({
            code: ModulesErrorCode.AgentNameInvalid,
            params: { min: 2, max: 40 },
        })
    })

    it("refuses an installation without an agent", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(recordOf({ agentId: null }))

        await expect(service.renameAgent("u1", "ws-1", "inst-1", "Mai")).rejects.toMatchObject({
            code: ModulesErrorCode.AgentMissing,
        })
    })

    it("renames the agent and asks for a sync without forcing it", async () => {
        const { service, installations, identity, sync } = await build()
        installations.find.mockResolvedValue(recordOf())

        await expect(service.renameAgent("u1", "ws-1", "inst-1", " Mai ")).resolves.toEqual({
            ...recordOf(),
            ...VIEWED,
        })
        expect(identity.rename).toHaveBeenCalledWith("u1", "ws-1", "agent-1", "Mai")
        expect(sync.announceNow).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            installationId: "inst-1",
            force: false,
        })
    })
})

describe("ModuleInstallService > saveSetting", () => {
    it("refuses a setting out of its range", async () => {
        const { service } = await build()

        await expect(service.saveSetting("u1", "ws-1", "inst-1", "openclawTimeoutSec", 999)).rejects.toMatchObject({
            code: ModulesErrorCode.SettingInvalid,
        })
    })

    it("merges the setting into the settings of the installation", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(recordOf())
        installations.saveSettings.mockResolvedValue("done")

        await service.saveSetting("u1", "ws-1", "inst-1", "holdingMessage", " One moment ")

        expect(installations.saveSettings).toHaveBeenCalledWith("ws-1", "inst-1", {
            openclawTimeoutSec: 30,
            holdingMessage: "One moment",
        })
    })
})

describe("ModuleInstallService > syncStatus", () => {
    it("answers the status of the copy", async () => {
        const { service, facts } = await build()
        facts.syncStatus.mockResolvedValue(SYNCED_AGENT_COPY)

        await expect(service.syncStatus("u1", "ws-1", "inst-1")).resolves.toEqual(SYNCED_AGENT_COPY)
    })

    it("refuses an installation of another workspace", async () => {
        const { service, facts } = await build()
        facts.syncStatus.mockResolvedValue(null)

        await expect(service.syncStatus("u1", "ws-1", "inst-1")).rejects.toMatchObject({
            code: ModulesErrorCode.InstallationNotFound,
        })
    })

    it("answers the installations of the workspace to any member", async () => {
        const { service, installations, members } = await build()
        installations.list.mockResolvedValue([recordOf()])

        await expect(service.list("u1", "ws-1")).resolves.toEqual([{ ...recordOf(), ...VIEWED }])
        expect(members.require).toHaveBeenCalledWith("u1", "ws-1")
    })

    it("refuses a missing installation", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(null)

        await expect(service.get("u1", "ws-1", "inst-1")).rejects.toMatchObject({
            code: ModulesErrorCode.InstallationNotFound,
        })
    })
})

describe("ModuleInstallService lifecycle and reads", () => {
    it("creates the first agent with the module's default name when every legacy agent is bound", async () => {
        const { service, installations, members, agents, events } = await build()
        installations.firstOfModule.mockResolvedValue(null)
        installations.instanceNames.mockResolvedValue([])
        installations.boundAgentIds.mockResolvedValue(["agent-1"])
        agents.list.mockResolvedValue([agentOf()])
        agents.create.mockResolvedValue(agentOf({ id: "agent-2" }))
        installations.insert.mockResolvedValue("inst-2")

        await expect(service.install("u1", requestOf({ name: "  Branch  desk  ", locale: "vi" }))).resolves.toEqual({
            installationId: "inst-2",
            agentId: "agent-2",
            created: true,
        })
        expect(members.require).toHaveBeenCalledWith("u1", "ws-1", ["owner", "manager"])
        expect(agents.list).toHaveBeenNthCalledWith(1, "u1", "ws-1", "chatbot")
        expect(agents.list).toHaveBeenNthCalledWith(2, "u1", "ws-1")
        expect(agents.create).toHaveBeenCalledWith("u1", {
            workspaceId: "ws-1",
            module: "chatbot",
            name: CHATBOT_MODULE.agent.name,
            handle: "chatbot-2",
            role: CHATBOT_MODULE.agent.role.vi,
            instructions: CHATBOT_MODULE.agent.instructions.vi,
        })
        expect(installations.insert).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            moduleKey: "chatbot",
            name: "Branch desk",
            agentId: "agent-2",
            operatingMode: "assist",
        })
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "module.installed",
            actor: "Lan",
            summary: `Lan: ${CHATBOT_MODULE.name.vi} - Branch desk`,
        })
    })

    it("reports a taken name after a first-instance race without a surviving installation", async () => {
        const { service, installations, agents, events, rules, sync } = await build()
        installations.firstOfModule.mockResolvedValue(null)
        installations.instanceNames.mockResolvedValue([])
        installations.boundAgentIds.mockResolvedValue([])
        agents.list.mockResolvedValue([agentOf()])
        installations.insert.mockResolvedValue(null)

        await expect(service.install("u1", requestOf())).rejects.toMatchObject({
            code: ModulesErrorCode.InstanceNameTaken,
        })
        expect(installations.firstOfModule).toHaveBeenCalledTimes(2)
        expect(installations.firstOfModule).toHaveBeenLastCalledWith("ws-1", "chatbot")
        expect(events.record).not.toHaveBeenCalled()
        expect(rules.seedDefaults).not.toHaveBeenCalled()
        expect(sync.announceNow).not.toHaveBeenCalled()
    })

    it("rejects a blank instance rename before reading or writing the installation", async () => {
        const { service, installations, members } = await build()

        await expect(service.rename("u1", "ws-1", "inst-1", " \t ")).rejects.toMatchObject({
            code: ModulesErrorCode.InstanceNameInvalid,
        })
        expect(members.require).toHaveBeenCalledWith("u1", "ws-1", ["owner", "manager"])
        expect(installations.find).not.toHaveBeenCalled()
        expect(installations.rename).not.toHaveBeenCalled()
    })
})

describe("ModuleInstallService > concurrent writes and reads", () => {
    it("reports an instance name taken by a concurrent rename", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(recordOf())
        installations.instanceNames.mockResolvedValue([{ id: "inst-2", name: "Night desk" }])
        installations.rename.mockResolvedValue("taken")

        await expect(service.rename("u1", "ws-1", "inst-1", " Lobby ")).rejects.toMatchObject({
            code: ModulesErrorCode.InstanceNameTaken,
        })
        expect(installations.instanceNames).toHaveBeenCalledWith("ws-1", "chatbot", "inst-1")
        expect(installations.rename).toHaveBeenCalledWith("ws-1", "inst-1", "Lobby")
        expect(installations.find).toHaveBeenCalledTimes(1)
    })

    it("writes the operating mode and reads the updated installation", async () => {
        const { service, installations, members } = await build()
        installations.setOperatingMode.mockResolvedValue("done")
        const updated = recordOf({ operatingMode: "autopilot" })
        installations.find.mockResolvedValue(updated)

        await expect(service.setOperatingMode("u1", "ws-1", "inst-1", "autopilot")).resolves.toEqual({
            ...updated,
            ...VIEWED,
        })
        expect(members.require).toHaveBeenCalledWith("u1", "ws-1", ["owner", "manager"])
        expect(installations.setOperatingMode).toHaveBeenCalledWith("ws-1", "inst-1", "autopilot")
        expect(installations.find).toHaveBeenCalledWith("ws-1", "inst-1")
    })

    it("pauses an installation with neither an agent nor an applied version", async () => {
        const { service, installations, agents } = await build()
        const paused = recordOf({ agentId: null, activeContextVersionId: null, status: "paused" })
        installations.find.mockResolvedValue(paused)
        installations.setLive.mockResolvedValue("done")

        await expect(service.setLive("u1", "ws-1", "inst-1", false)).resolves.toEqual({
            ...paused,
            ...VIEWED,
        })
        expect(installations.setLive).toHaveBeenCalledWith("ws-1", "inst-1", false, false, expect.anything())
        expect(agents.setStatus).not.toHaveBeenCalled()
        expect(installations.find).toHaveBeenCalledTimes(2)
    })

    it("answers record ownership after checking workspace membership", async () => {
        const { service, recordOwners, members } = await build()
        recordOwners.installationOfRecord.mockResolvedValue({ installationId: "inst-1" })

        await expect(service.installationOfRecord("u1", "ws-1", "record-1")).resolves.toEqual({
            installationId: "inst-1",
        })
        expect(members.require).toHaveBeenCalledWith("u1", "ws-1")
        expect(recordOwners.installationOfRecord).toHaveBeenCalledWith("ws-1", "record-1")
    })

    it("answers requirement facts after checking workspace membership", async () => {
        const { service, facts, members } = await build()
        const answer = { providers: ["meta"], chatAgents: 2, staff: 3, members: 4 }
        facts.requirementFacts.mockResolvedValue(answer)

        await expect(service.requirementFacts("u1", "ws-1")).resolves.toEqual(answer)
        expect(members.require).toHaveBeenCalledWith("u1", "ws-1")
        expect(facts.requirementFacts).toHaveBeenCalledWith("ws-1")
    })
})
