import { Test } from "@nestjs/testing"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentBindingsService } from "./agent-bindings.service"
import { BINDING_AGENTS, BINDING_MANAGERS } from "./agent-connections.decorators"
import type { BindingAgentsDirectory, BindingManagers } from "./agent-connections.port"
import { ChannelOwnersService } from "./channel-owners.service"
import { AgentConnectionsErrorCode } from "./errors/agent-connections.error"
import { AgentConnectionEntity } from "./persistence/entities"

const GRANT = {
    workspaceId: "w1",
    agentId: "a1",
    connectionId: "c1",
    purpose: "inbound_chat" as const,
    access: "ask" as const,
}

const AGENT = { id: "a1", module: "sales", name: "Minh", createdAt: new Date("2026-10-01T00:00:00.000Z") }

/** Who calls, and whether the manager scope says they manage the agent. */
interface Caller {
    readonly role: "owner" | "manager" | "staff"
    readonly manages?: boolean
}

const build = async (entityManager: MockEntityManager, caller: Caller) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "u1",
        workspaceId: "w1",
        role: caller.role,
        staffId: null,
        displayName: "Caller",
        status: "active",
    })
    const managers = mock<BindingManagers>()
    managers.canManage.mockResolvedValue(caller.manages ?? true)
    const agents = mock<BindingAgentsDirectory>()
    agents.activeCreatedAmong.mockResolvedValue([AGENT])
    agents.holds.mockResolvedValue(true)
    const connections = mock<ConnectionBindingsReadService>()
    connections.holds.mockResolvedValue(true)
    const channelOwners = mock<ChannelOwnersService>()
    channelOwners.requireFree.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentBindingsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BINDING_AGENTS, useValue: agents },
            { provide: BINDING_MANAGERS, useValue: managers },
            { provide: ConnectionBindingsReadService, useValue: connections },
            { provide: ChannelOwnersService, useValue: channelOwners },
        ],
    }).compile()
    return { service: moduleRef.get(AgentBindingsService), members, managers, channelOwners }
}

const writes = (em: MockEntityManager) => {
    fakeTransaction(em)
    return queueQueryBuilders(em, [{ execute: {} }])[0]
}

const grantOf = (access: string) => Object.assign(new AgentConnectionEntity(), { access })

describe("AgentBindingsService > grant by an owner", () => {
    it("lets the owner grant any agent any level without asking the manager scope", async () => {
        const em = mockEntityManager()
        const write = writes(em)
        const { service, managers } = await build(em, { role: "owner", manages: false })

        await service.grant("u1", { ...GRANT, access: "auto" })

        expect(managers.canManage).not.toHaveBeenCalled()
        expect(write?.callsOf("values")).toEqual([
            [{ agentId: "a1", connectionId: "c1", workspaceId: "w1", purpose: "inbound_chat", access: "auto" }],
        ])
    })
})

describe("AgentBindingsService > grant by a manager", () => {
    it("lets a manager grant a channel to an agent in the rooms and roles they manage, up to asking first", async () => {
        const em = mockEntityManager()
        em.findOne.mockResolvedValue(null)
        const write = writes(em)
        const { service, managers } = await build(em, { role: "manager" })

        await service.grant("u1", GRANT)

        expect(managers.canManage).toHaveBeenCalledWith("w1", "u1", "a1")
        expect(write?.callsOf("values")).toEqual([
            [{ agentId: "a1", connectionId: "c1", workspaceId: "w1", purpose: "inbound_chat", access: "ask" }],
        ])
    })

    it("refuses a manager an agent outside their rooms and roles, and writes nothing", async () => {
        const em = mockEntityManager()
        const { service } = await build(em, { role: "manager", manages: false })

        await expect(service.grant("u1", GRANT)).rejects.toMatchObject({
            code: AgentConnectionsErrorCode.OutOfScope,
            params: { agentId: "a1" },
        })
        expect(em.transaction).not.toHaveBeenCalled()
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("never lets a manager widen the access past asking first", async () => {
        const em = mockEntityManager()
        em.findOne.mockResolvedValue(null)
        fakeTransaction(em)
        const { service } = await build(em, { role: "manager" })

        await expect(service.grant("u1", { ...GRANT, access: "auto" })).rejects.toMatchObject({
            code: AgentConnectionsErrorCode.AccessAboveCeiling,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("never lets a manager raise an asking grant to auto", async () => {
        const em = mockEntityManager()
        fakeTransaction(em)
        em.findOne.mockResolvedValue(grantOf("ask"))
        const { service } = await build(em, { role: "manager" })

        await expect(service.grant("u1", { ...GRANT, access: "auto" })).rejects.toMatchObject({
            code: AgentConnectionsErrorCode.AccessAboveCeiling,
        })
    })

    it("lets a manager keep the level the owner gave", async () => {
        const em = mockEntityManager()
        const write = writes(em)
        em.findOne.mockResolvedValue(grantOf("auto"))
        const { service } = await build(em, { role: "manager" })

        await service.grant("u1", { ...GRANT, access: "auto" })

        expect(write?.callsOf("values")).toHaveLength(1)
    })

    it("keeps one agent per role per channel for a manager too", async () => {
        const em = mockEntityManager()
        em.findOne.mockResolvedValue(null)
        fakeTransaction(em)
        const { service, channelOwners } = await build(em, { role: "manager" })
        const owned = Object.assign(new Error("owned"), { code: AgentConnectionsErrorCode.ChannelOwned })
        channelOwners.requireFree.mockRejectedValue(owned)

        await expect(service.grant("u1", GRANT)).rejects.toBe(owned)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("holds a manager's revoke to the same scope", async () => {
        const em = mockEntityManager()
        const { service } = await build(em, { role: "manager", manages: false })

        await expect(
            service.revoke("u1", { workspaceId: "w1", agentId: "a1", connectionId: "c1" }),
        ).rejects.toMatchObject({ code: AgentConnectionsErrorCode.OutOfScope })
        expect(em.delete).not.toHaveBeenCalled()
    })
})

describe("AgentBindingsService > grant by staff", () => {
    it("refuses staff before anything else", async () => {
        const em = mockEntityManager()
        const { service, members, managers } = await build(em, { role: "staff" })
        members.require.mockRejectedValue(new Error("not a manager"))

        await expect(service.grant("u1", GRANT)).rejects.toThrow("not a manager")
        expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
        expect(managers.canManage).not.toHaveBeenCalled()
        expect(em.transaction).not.toHaveBeenCalled()
    })
})

describe("AgentBindingsService > grant without a manager scope", () => {
    it("refuses a manager when the app gave no manager scope: only the owner may then", async () => {
        const em = mockEntityManager()
        const members = mock<WorkspaceMembersService>()
        members.require.mockResolvedValue({
            userId: "u1",
            workspaceId: "w1",
            role: "manager",
            staffId: null,
            displayName: "Caller",
            status: "active",
        })
        const moduleRef = await Test.createTestingModule({
            providers: [
                AgentBindingsService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
                { provide: WorkspaceMembersService, useValue: members },
                { provide: BINDING_AGENTS, useValue: mock<BindingAgentsDirectory>() },
                { provide: ConnectionBindingsReadService, useValue: mock<ConnectionBindingsReadService>() },
                { provide: ChannelOwnersService, useValue: mock<ChannelOwnersService>() },
            ],
        }).compile()

        await expect(moduleRef.get(AgentBindingsService).grant("u1", GRANT)).rejects.toMatchObject({
            code: AgentConnectionsErrorCode.OutOfScope,
        })
    })
})
