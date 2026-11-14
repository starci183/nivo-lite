import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { BoundConnection } from "@modules/domain/agent-connections"
import { AgentsService } from "@modules/domain/agents"
import { ApiKeysService } from "@modules/domain/api-keys"
import { EventsService } from "@modules/domain/events"
import { WebsiteSitesService } from "@modules/domain/inbox-leads"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InstallationChangesService } from "./installation-changes.service"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    INSTALLING_MEMBER as MEMBER,
    installationRecordOf as recordOf,
} from "@tests/fixtures/builders/module-install.builder"
import { AgentAccountsService } from "@modules/domain/tools"
import { AGENT_RECORDS } from "./agent-records.port"
import type { AgentRecordsPort } from "./agent-records.port"
import { AgentRemovalService } from "./agent-removal.service"
import { ModulesErrorCode } from "./errors/modules.error"
import { ModuleReadinessService } from "./module-readiness.service"

/** The agent and version fields of an installation view. */
const VIEWED_AGENT = {
    agentName: "Chatbot",
    agentHandle: "chatbot",
    agentAvatarUrl: null,
    agentAvatarPreset: null,
    activeVersion: 1,
    setupProgress: { confirmed: 0, total: 8 },
} as const

const build = async ({ website = true } = {}) => {
    const tx = fakeTransaction(mockEntityManager())
    const installations = mock<InstallationRecordsService>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const agents = mock<AgentsService>()
    const events = mock<EventsService>()
    const sync = mock<InstallationChangesService>()
    const readiness = mock<ModuleReadinessService>()
    readiness.withNeeds.mockImplementation((record) =>
        Promise.resolve({ ...record, ...VIEWED_AGENT, connectionNeeds: [], lifecycle: "removed" }),
    )
    const abilities = mock<AgentAccountsService>()
    abilities.detachAgent.mockResolvedValue(2)
    const records = mock<AgentRecordsPort>()
    records.erase.mockResolvedValue({ records: 0, files: [] })
    records.removeFiles.mockResolvedValue(undefined)
    const bindings = mock<AgentBindingsService>()
    bindings.channelsWithoutOtherFrontDoor.mockResolvedValue([])
    const keys = mock<ApiKeysService>()
    keys.publicKeysOfAgent.mockResolvedValue([])
    const sites = mock<WebsiteSitesService>()
    sites.frontDoorSiteOf.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRemovalService,
            { provide: AgentBindingsService, useValue: bindings },
            { provide: ApiKeysService, useValue: keys },
            ...(website ? [{ provide: WebsiteSitesService, useValue: sites }] : []),
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentsService, useValue: agents },
            { provide: EventsService, useValue: events },
            { provide: InstallationChangesService, useValue: sync },
            { provide: ModuleReadinessService, useValue: readiness },
            { provide: AgentAccountsService, useValue: abilities },
            { provide: AGENT_RECORDS, useValue: records },
        ],
    }).compile()
    return {
        tx,
        service: moduleRef.get(AgentRemovalService),
        installations,
        members,
        agents,
        events,
        sync,
        abilities,
        records,
        bindings,
        keys,
        sites,
    }
}

describe("AgentRemovalService > remove", () => {
    it("removes the installation and stops its agent in one transaction, then queues the sync", async () => {
        const { tx, service, installations, members, agents, events, sync } = await build()
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
        expect(tx.commits).toBe(1)
        expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "module.removed" }))
        expect(sync.announce).toHaveBeenCalledWith(
            { workspaceId: "ws-1", installationId: "inst-1", force: false },
            expect.anything(),
        )
    })

    it("leaves a removed agent attached to no connected account, and touches no attachment when nothing is removed", async () => {
        const { service, installations, abilities } = await build()
        installations.find
            .mockResolvedValueOnce(recordOf({ isMulti: false }))
            .mockResolvedValueOnce(recordOf({ status: "removed", liveEnabled: false }))
            .mockResolvedValueOnce(recordOf({ status: "removed", liveEnabled: false }))
        installations.markRemoved.mockResolvedValue("done")

        await service.remove("u1", "ws-1", "inst-1")
        expect(abilities.detachAgent).toHaveBeenCalledWith("ws-1", "agent-1")

        abilities.detachAgent.mockClear()
        await service.remove("u1", "ws-1", "inst-1")
        expect(abilities.detachAgent).not.toHaveBeenCalled()
    })

    it("removes an installation that has no agent without touching agents", async () => {
        const { service, installations, agents } = await build()
        installations.find
            .mockResolvedValueOnce(recordOf({ agentId: null, isMulti: true }))
            .mockResolvedValueOnce(recordOf({ agentId: null, status: "removed" }))
        installations.markRemoved.mockResolvedValue("done")

        await service.remove("u1", "ws-1", "inst-1")

        expect(agents.setStatus).not.toHaveBeenCalled()
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

describe("AgentRemovalService > remove: the agent's records die with it", () => {
    const removable = (installations: Awaited<ReturnType<typeof build>>["installations"]) => {
        installations.find
            .mockResolvedValueOnce(recordOf({ isMulti: false }))
            .mockResolvedValueOnce(recordOf({ status: "removed", liveEnabled: false }))
        installations.markRemoved.mockResolvedValue("done")
    }

    it("erases the agent's records inside the removal's transaction, before the agent is stopped, and removes their files only after it committed", async () => {
        const { tx, service, installations, agents, records } = await build()
        removable(installations)
        records.erase.mockResolvedValue({ records: 5, files: ["k-1", "k-2"] })
        records.removeFiles.mockImplementation(() => {
            expect(tx.commits).toBe(1)
            return Promise.resolve()
        })

        await service.remove("u1", "ws-1", "inst-1")

        expect(records.erase).toHaveBeenCalledWith("ws-1", "agent-1", expect.anything())
        expect(records.erase.mock.invocationCallOrder[0]).toBeLessThan(installations.markRemoved.mock.invocationCallOrder[0] ?? 0)
        expect(records.erase.mock.invocationCallOrder[0]).toBeLessThan(agents.setStatus.mock.invocationCallOrder[0] ?? 0)
        expect(records.removeFiles).toHaveBeenCalledWith(["k-1", "k-2"])
        expect(records.removeFiles).toHaveBeenCalledTimes(1)
    })

    it("removes no file when the removal fails: the transaction rolls back with the records in it", async () => {
        const { tx, service, installations, records } = await build()
        removable(installations)
        records.erase.mockResolvedValue({ records: 5, files: ["k-1"] })
        installations.markRemoved.mockRejectedValue(new Error("boom"))

        await expect(service.remove("u1", "ws-1", "inst-1")).rejects.toThrow("boom")

        expect(tx.commits).toBe(0)
        expect(records.removeFiles).not.toHaveBeenCalled()
    })

    it("removes nothing and stops nothing when the records cannot be erased", async () => {
        const { service, installations, agents, records } = await build()
        removable(installations)
        records.erase.mockRejectedValue(new Error("engine down"))

        await expect(service.remove("u1", "ws-1", "inst-1")).rejects.toThrow("engine down")

        expect(installations.markRemoved).not.toHaveBeenCalled()
        expect(agents.setStatus).not.toHaveBeenCalled()
        expect(records.removeFiles).not.toHaveBeenCalled()
    })

    it("erases nothing for an installation that has no agent, and removes no file when the agent held none", async () => {
        const { service, installations, records } = await build()
        installations.find
            .mockResolvedValueOnce(recordOf({ agentId: null, isMulti: true }))
            .mockResolvedValueOnce(recordOf({ agentId: null, status: "removed" }))
        installations.markRemoved.mockResolvedValue("done")

        await service.remove("u1", "ws-1", "inst-1")

        expect(records.erase).not.toHaveBeenCalled()
        expect(records.removeFiles).not.toHaveBeenCalled()
    })
})

describe("AgentRemovalService > impactOf: what removing the agent takes with it", () => {
    it("answers the records per type with a title, the totals and the files, for an owner or manager", async () => {
        const { service, installations, members, records } = await build()
        installations.find.mockResolvedValue(recordOf({ isMulti: false }))
        records.footprintOf.mockResolvedValue({
            types: [
                { type: "blocks-core.chatbot.message", count: 120 },
                { type: "blocks-core.sales.order-line", count: 3 },
            ],
            records: 123,
            files: 4,
        })

        await expect(service.impactOf("u1", "ws-1", "inst-1")).resolves.toEqual({
            installationId: "inst-1",
            agentId: "agent-1",
            recordTypes: [
                { type: "blocks-core.chatbot.message", title: "Message", count: 120 },
                { type: "blocks-core.sales.order-line", title: "Order line", count: 3 },
            ],
            records: 123,
            files: 4,
            channels: [],
        })
        expect(members.require).toHaveBeenCalledWith("u1", "ws-1", ["owner", "manager"])
        expect(records.footprintOf).toHaveBeenCalledWith("ws-1", "agent-1")
    })

    it("answers an empty footprint for an installation with no agent, an already removed one, or no records store", async () => {
        const { service, installations, records } = await build()
        const empty = { recordTypes: [], records: 0, files: 0, channels: [] }
        installations.find.mockResolvedValueOnce(recordOf({ agentId: null }))
        await expect(service.impactOf("u1", "ws-1", "inst-1")).resolves.toMatchObject({ agentId: null, ...empty })
        installations.find.mockResolvedValueOnce(recordOf({ status: "removed" }))
        await expect(service.impactOf("u1", "ws-1", "inst-1")).resolves.toMatchObject(empty)
        expect(records.footprintOf).not.toHaveBeenCalled()
    })

    it("refuses an installation that is not of the workspace", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(null)
        await expect(service.impactOf("u1", "ws-1", "inst-9")).rejects.toMatchObject({ code: ModulesErrorCode.InstallationNotFound })
    })
})

describe("AgentRemovalService > impactOf: the channels that lose their front door", () => {
    const ZALO: BoundConnection = {
        id: "conn-1",
        provider: "zalo_oa",
        name: "Tiem hoa Lan",
        botUsername: null,
        accountMasked: null,
        status: "connected",
        purpose: "inbound_chat",
    }

    it("names each customer channel nobody else would answer: a provider connection, the website site and a public API key scoped to the agent", async () => {
        const { service, installations, bindings, sites, keys, records } = await build()
        installations.find.mockResolvedValue(recordOf({ isMulti: false }))
        records.footprintOf.mockResolvedValue({ types: [], records: 0, files: 0 })
        bindings.channelsWithoutOtherFrontDoor.mockResolvedValue([ZALO])
        sites.frontDoorSiteOf.mockResolvedValue({ siteKey: "site-key-1" })
        keys.publicKeysOfAgent.mockResolvedValue([{ id: "key-1", name: "Shop app" }])

        const impact = await service.impactOf("u1", "ws-1", "inst-1")

        expect(impact.channels).toEqual([
            { kind: "connection", name: "Tiem hoa Lan", provider: "zalo_oa", connectionId: "conn-1" },
            { kind: "website", name: "site-key-1", provider: null, connectionId: null },
            { kind: "api_key", name: "Shop app", provider: null, connectionId: null },
        ])
        expect(bindings.channelsWithoutOtherFrontDoor).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(sites.frontDoorSiteOf).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(keys.publicKeysOfAgent).toHaveBeenCalledWith("ws-1", "agent-1")
    })

    it("names no channel for an installation with no agent or one already removed, and reads no store for it", async () => {
        const { service, installations, bindings, sites, keys } = await build()
        installations.find.mockResolvedValueOnce(recordOf({ agentId: null }))
        await expect(service.impactOf("u1", "ws-1", "inst-1")).resolves.toMatchObject({ channels: [] })
        installations.find.mockResolvedValueOnce(recordOf({ status: "removed" }))
        await expect(service.impactOf("u1", "ws-1", "inst-1")).resolves.toMatchObject({ channels: [] })

        expect(bindings.channelsWithoutOtherFrontDoor).not.toHaveBeenCalled()
        expect(sites.frontDoorSiteOf).not.toHaveBeenCalled()
        expect(keys.publicKeysOfAgent).not.toHaveBeenCalled()
    })

    it("answers the connection channels alone where the website intake is not composed", async () => {
        const { service, installations, bindings, records } = await build({ website: false })
        installations.find.mockResolvedValue(recordOf({ isMulti: false }))
        records.footprintOf.mockResolvedValue({ types: [], records: 0, files: 0 })
        bindings.channelsWithoutOtherFrontDoor.mockResolvedValue([ZALO])

        const impact = await service.impactOf("u1", "ws-1", "inst-1")

        expect(impact.channels.map((channel) => channel.kind)).toEqual(["connection"])
    })
})
