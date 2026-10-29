import { Test } from "@nestjs/testing"
import {
    askLink,
    inboundLinks,
    linkOf,
    outboundLinks,
    readOnlyOutboundLink,
    toolLink,
    twoAgentLinks,
} from "@tests/fixtures/builders/agent-connections.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentBindingsService } from "./agent-bindings.service"
import { AgentConnectionsErrorCode } from "./errors/agent-connections.error"
import { AgentConnectionEntity } from "./persistence/entities"

const agentOf = (id: string, module: string, name: string, day: number) => ({
    id,
    module,
    name,
    createdAt: new Date(`2026-10-0${day}T00:00:00.000Z`),
})

const connectionOf = (id: string, status: string, day: number, botUsername: string | null = null) => ({
    id,
    provider: "telegram",
    name: `Bot ${id}`,
    status,
    createdAt: new Date(`2026-10-0${day}T00:00:00.000Z`),
    botUsername,
    accountMasked: null,
})

/** The agents and connections the owners answer, and whether the workspace holds the agent and the connection of a grant. */
interface Owners {
    readonly agents?: ReadonlyArray<ReturnType<typeof agentOf>>
    readonly connections?: ReadonlyArray<ReturnType<typeof connectionOf>>
    readonly holdsAgent?: boolean
    readonly holdsConnection?: boolean
}

const build = async (entityManager: MockEntityManager, owners: Owners = {}) => {
    const members = mock<WorkspaceMembersService>()
    const agents = mock<AgentDirectoryService>()
    agents.activeCreatedAmong.mockResolvedValue([...(owners.agents ?? [])])
    agents.holds.mockResolvedValue(owners.holdsAgent ?? true)
    const connections = mock<ConnectionBindingsReadService>()
    connections.factsOf.mockResolvedValue([...(owners.connections ?? [])])
    connections.holds.mockResolvedValue(owners.holdsConnection ?? true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentBindingsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: ConnectionBindingsReadService, useValue: connections },
        ],
    }).compile()
    return { service: moduleRef.get(AgentBindingsService), members, agents, connections }
}

const INBOUND_LINKS = inboundLinks()
const INBOUND_AGENTS = [
    agentOf("a1", "chatbot", "Bot", 1),
    agentOf("a2", "booking", "Booker", 2),
    agentOf("a3", "sales", "Seller", 3),
]

describe("AgentBindingsService > agentsFor", () => {
    it("lists the active agents bound for the purposes, oldest first", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, INBOUND_LINKS] })
        const { service, agents } = await build(em, { agents: INBOUND_AGENTS })

        const bound = await service.agentsFor("c1", ["inbound_chat", "tool"])

        expect(bound.map((agent) => agent.id)).toEqual(["a1", "a2", "a3"])
        expect(em.find).toHaveBeenCalledWith(AgentConnectionEntity, {
            where: { connectionId: "c1", purpose: In(["inbound_chat", "tool"]) },
            take: 200,
        })
        expect(agents.activeCreatedAmong).toHaveBeenCalledWith("w1", ["a1", "a2", "a3"], 200)
    })

    it("takes one purpose as a list of one and answers nothing for a connection nobody is bound to", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, []] })
        const { service, agents } = await build(em)

        await expect(service.agentsFor("c1", "inbound_chat", { acting: true })).resolves.toEqual([])
        expect(agents.activeCreatedAmong).not.toHaveBeenCalled()
    })

    it("leaves out the bindings of agents the owner does not list as active", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, INBOUND_LINKS] })
        const { service } = await build(em, { agents: [INBOUND_AGENTS[0] ?? agentOf("a1", "chatbot", "Bot", 1)] })

        const bound = await service.agentsFor("c1", "inbound_chat")

        expect(bound.map((agent) => agent.id)).toEqual(["a1"])
    })
})

describe("AgentBindingsService > connectionsFor", () => {
    it("includes pending read grants with the default options and names the bot", async () => {
        const link = readOnlyOutboundLink()
        const em = mockEntityManager({ find: [AgentConnectionEntity, [link]] })
        const { service } = await build(em, { connections: [connectionOf("c1", "pending", 1, "shop_bot")] })

        await expect(service.connectionsFor("a1", "outbound_chat")).resolves.toEqual([
            {
                id: "c1",
                provider: "telegram",
                name: "Bot c1",
                botUsername: "shop_bot",
                accountMasked: null,
                status: "pending",
                access: "read",
                purpose: "outbound_chat",
            },
        ])
        expect(em.find).toHaveBeenCalledWith(AgentConnectionEntity, {
            where: { agentId: "a1", purpose: In(["outbound_chat"]) },
            take: 200,
        })
    })

    it("lists the connected connections of an agent, oldest connection first", async () => {
        const links = outboundLinks()
        const em = mockEntityManager({ find: [AgentConnectionEntity, links] })
        const { service, connections } = await build(em, {
            connections: [
                connectionOf("c1", "connected", 2),
                connectionOf("c2", "disconnected", 1),
                connectionOf("c3", "connected", 2),
            ],
        })

        const bound = await service.connectionsFor("a1", "outbound_chat", { connectedOnly: true })

        expect(bound.map((connection) => connection.id)).toEqual(["c1", "c3"])
        expect(connections.factsOf).toHaveBeenCalledWith(["c1", "c2", "c3"], 200)
    })
})

describe("AgentBindingsService > connectionsOfAgent", () => {
    it("lists every connection of an agent of the workspace for a member, whatever the purpose", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, [toolLink()]] })
        const { service, members } = await build(em, { connections: [connectionOf("c1", "connected", 1)] })

        const bound = await service.connectionsOfAgent("u1", "w1", "a1")

        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(bound.map((connection) => connection.id)).toEqual(["c1"])
        expect(em.find).toHaveBeenCalledWith(AgentConnectionEntity, {
            where: {
                agentId: "a1",
                workspaceId: "w1",
                purpose: In(["inbound_chat", "outbound_chat", "bank_feed", "data_source", "tool", "lead_source"]),
            },
            take: 200,
        })
    })

    it("reads nothing for someone who is not a member", async () => {
        const em = mockEntityManager()
        const { service, members } = await build(em)
        const refusal = new Error("not a member")
        members.require.mockRejectedValue(refusal)

        await expect(service.connectionsOfAgent("u1", "w1", "a1")).rejects.toBe(refusal)
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("AgentBindingsService > routing", () => {
    it("makes the chatbot the front door and hands over to the booking agent", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, INBOUND_LINKS] })
        const { service } = await build(em, { agents: INBOUND_AGENTS })

        const route = await service.routeInbound("c1")

        expect(route.front?.id).toBe("a1")
        expect(route.handovers.map((agent) => agent.id)).toEqual(["a2"])
    })

    it("lists the bound agents of other modules a conversation can hand over to", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, INBOUND_LINKS] })
        const { service } = await build(em, { agents: INBOUND_AGENTS })

        const handovers = await service.handoversOf("c1", { module: "chatbot" })

        expect(handovers.map((agent) => agent.id)).toEqual(["a2"])
    })

    it("hands over to nobody for a conversation without a connection", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.handoversOf(null, { module: "chatbot" })).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })
})

const GRANT = {
    workspaceId: "w1",
    agentId: "a1",
    connectionId: "c1",
    purpose: "inbound_chat" as const,
    access: "ask" as const,
}

describe("AgentBindingsService > grant", () => {
    it("lets a manager grant a connection to an agent of the workspace", async () => {
        const em = mockEntityManager()
        fakeTransaction(em)
        const [write] = queueQueryBuilders(em, [{ execute: {} }])
        const { service, members, agents, connections } = await build(em)

        await service.grant("u1", GRANT)

        expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
        expect(agents.holds).toHaveBeenCalledWith("w1", "a1", expect.anything())
        expect(connections.holds).toHaveBeenCalledWith("w1", "c1", expect.anything())
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AgentConnectionEntity, "ac")
        expect(write?.callsOf("values")).toEqual([
            [{ agentId: "a1", connectionId: "c1", workspaceId: "w1", purpose: "inbound_chat", access: "ask" }],
        ])
        expect(write?.callsOf("orUpdate")).toEqual([
            [
                ["purpose", "access"],
                ["agent_id", "connection_id"],
            ],
        ])
    })

    it.each([
        { holdsAgent: false, holdsConnection: true },
        { holdsAgent: true, holdsConnection: false },
    ])("refuses an agent or connection that is not in the workspace: %j", async (owners) => {
        const em = mockEntityManager()
        fakeTransaction(em)
        const { service } = await build(em, owners)

        await expect(service.grant("u1", GRANT)).rejects.toMatchObject({
            code: AgentConnectionsErrorCode.TargetNotFound,
            params: { agentId: "a1", connectionId: "c1" },
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("writes nothing for someone who is not a manager", async () => {
        const em = mockEntityManager()
        const { service, members } = await build(em)
        const refusal = new Error("not a manager")
        members.require.mockRejectedValue(refusal)

        await expect(service.grant("u1", GRANT)).rejects.toBe(refusal)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("AgentBindingsService > writeGrant", () => {
    const grant = { ...GRANT, purpose: "tool" as const, access: "auto" as const }
    const values = [{ agentId: "a1", connectionId: "c1", workspaceId: "w1", purpose: "tool", access: "auto" }]

    it("writes the proved grant with the primary manager by default", async () => {
        const em = mockEntityManager()
        const [write] = queueQueryBuilders(em, [{ execute: {} }])
        const { service, members } = await build(em)

        await expect(service.writeGrant(grant)).resolves.toBeUndefined()

        expect(write?.callsOf("values")).toEqual([values])
        expect(members.require).not.toHaveBeenCalled()
    })

    it("writes the proved grant with the caller's transaction manager", async () => {
        const em = mockEntityManager()
        const manager = mockEntityManager()
        const [write] = queueQueryBuilders(manager, [{ execute: {} }])
        const { service } = await build(em)

        await expect(service.writeGrant(grant, manager)).resolves.toBeUndefined()

        expect(write?.callsOf("values")).toEqual([values])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("AgentBindingsService > removing grants", () => {
    const target = { workspaceId: "w1", agentId: "a1", connectionId: "c1" }
    const deleted = { agentId: "a1", connectionId: "c1", workspaceId: "w1" }

    it("removes the proved grant with the primary manager by default", async () => {
        const em = mockEntityManager({ delete: [AgentConnectionEntity, {}] })
        const { service, members } = await build(em)

        await expect(service.removeGrant(target)).resolves.toBeUndefined()

        expect(em.delete).toHaveBeenCalledWith(AgentConnectionEntity, deleted)
        expect(members.require).not.toHaveBeenCalled()
    })

    it("removes the proved grant with the caller's transaction manager", async () => {
        const em = mockEntityManager()
        const manager = mockEntityManager({ delete: [AgentConnectionEntity, {}] })
        const { service } = await build(em)

        await expect(service.removeGrant(target, manager)).resolves.toBeUndefined()

        expect(manager.delete).toHaveBeenCalledWith(AgentConnectionEntity, deleted)
        expect(em.delete).not.toHaveBeenCalled()
    })

    it("removes the grant for a manager", async () => {
        const em = mockEntityManager({ delete: [AgentConnectionEntity, {}] })
        const { service, members } = await build(em)

        await service.revoke("u1", target)

        expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
        expect(em.delete).toHaveBeenCalledWith(AgentConnectionEntity, deleted)
    })
})

describe("AgentBindingsService > agentIdsOf", () => {
    it("lists the agents attached to a connection of the workspace in the order they were attached, bounded", async () => {
        const em = mockEntityManager({
            find: [AgentConnectionEntity, twoAgentLinks()],
        })
        const { service } = await build(em)

        await expect(service.agentIdsOf("w1", "c1", 500)).resolves.toEqual(["agent-2", "agent-1"])
        expect(em.find).toHaveBeenCalledWith(AgentConnectionEntity, {
            select: { agentId: true },
            where: { workspaceId: "w1", connectionId: "c1" },
            order: { createdAt: "ASC" },
            take: 500,
        })
    })
})

describe("AgentBindingsService > stored grants", () => {
    const READ = { select: { agentId: true, connectionId: true, access: true }, order: { createdAt: "ASC" }, take: 500 }

    it.each([
        { name: "the workspace", ask: "grantsOfWorkspace", args: [] as Array<string>, where: { workspaceId: "w1" } },
        { name: "an agent", ask: "grantsOfAgent", args: ["a1"], where: { workspaceId: "w1", agentId: "a1" } },
        {
            name: "a connection",
            ask: "grantsOfConnection",
            args: ["c1"],
            where: { workspaceId: "w1", connectionId: "c1" },
        },
    ] as const)("lists the grants of $name, oldest first, bounded", async ({ ask, args, where }) => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, [askLink()]] })
        const { service } = await build(em)

        await expect(service[ask]("w1", ...(args as [string]))).resolves.toEqual([
            { agentId: "a1", connectionId: "c1", access: "ask" },
        ])
        expect(em.find).toHaveBeenCalledWith(AgentConnectionEntity, { ...READ, where })
    })

    it("lists the grants among some agents and connections", async () => {
        const em = mockEntityManager({ find: [AgentConnectionEntity, [linkOf()]] })
        const { service } = await build(em)

        await service.grantsAmong("w1", ["a1"], ["c1"])

        expect(em.find).toHaveBeenCalledWith(AgentConnectionEntity, {
            ...READ,
            where: { workspaceId: "w1", agentId: In(["a1"]), connectionId: In(["c1"]) },
        })
    })
})
