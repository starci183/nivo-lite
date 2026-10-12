import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentBindingsService } from "./agent-bindings.service"
import { AgentsErrorCode } from "./errors/agents.error"
import {
    DELETE_BINDING,
    LIST_AGENTS_OF_CONNECTION,
    LIST_CONNECTIONS_OF_AGENT,
    UPSERT_BINDING,
} from "./persistence/agent-connections.sql"

const AGENT_ROWS = [
    {
        id: "a2",
        module: "booking",
        name: "Booker",
        created_at: "2026-10-02T00:00:00.000Z",
        access: "auto",
        purpose: "inbound_chat",
    },
    {
        id: "a1",
        module: "chatbot",
        name: "Bot",
        created_at: "2026-10-01T00:00:00.000Z",
        access: "auto",
        purpose: "inbound_chat",
    },
    {
        id: "a3",
        module: "sales",
        name: "Seller",
        created_at: "2026-10-03T00:00:00.000Z",
        access: "auto",
        purpose: "inbound_chat",
    },
]

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentBindingsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(AgentBindingsService), members }
}

describe("AgentBindingsService", () => {
    describe("agentsFor", () => {
        it("lists the active agents bound for the purposes, oldest first", async () => {
            const em = mockEntityManager({ query: [LIST_AGENTS_OF_CONNECTION, AGENT_ROWS] })
            const { service } = await build(em)

            const agents = await service.agentsFor("c1", ["inbound_chat", "tool"])

            expect(agents.map((agent) => agent.id)).toEqual(["a1", "a2", "a3"])
            expect(em.query).toHaveBeenCalledWith(LIST_AGENTS_OF_CONNECTION, ["c1", ["inbound_chat", "tool"]])
        })

        it("takes one purpose as a list of one", async () => {
            const em = mockEntityManager({ query: [LIST_AGENTS_OF_CONNECTION, []] })
            const { service } = await build(em)

            await service.agentsFor("c1", "inbound_chat", { acting: true })

            expect(em.query).toHaveBeenCalledWith(LIST_AGENTS_OF_CONNECTION, ["c1", ["inbound_chat"]])
        })
    })

    describe("connectionsFor", () => {
        it("lists the connected connections of an agent", async () => {
            const rows = [
                {
                    id: "c1",
                    provider: "telegram",
                    name: "Shop bot",
                    status: "connected",
                    created_at: "2026-10-01T00:00:00.000Z",
                    access: "ask",
                    purpose: "outbound_chat",
                },
                {
                    id: "c2",
                    provider: "telegram",
                    name: "Old bot",
                    status: "disconnected",
                    created_at: "2026-09-01T00:00:00.000Z",
                    access: "ask",
                    purpose: "outbound_chat",
                },
            ]
            const em = mockEntityManager({ query: [LIST_CONNECTIONS_OF_AGENT, rows] })
            const { service } = await build(em)

            const connections = await service.connectionsFor("a1", "outbound_chat", { connectedOnly: true })

            expect(connections.map((connection) => connection.id)).toEqual(["c1"])
            expect(em.query).toHaveBeenCalledWith(LIST_CONNECTIONS_OF_AGENT, ["a1", ["outbound_chat"]])
        })
    })

    describe("routeInbound", () => {
        it("makes the chatbot the front door and hands over to the booking agent", async () => {
            const { service } = await build(mockEntityManager({ query: [LIST_AGENTS_OF_CONNECTION, AGENT_ROWS] }))

            const route = await service.routeInbound("c1")

            expect(route.front?.id).toBe("a1")
            expect(route.handovers.map((agent) => agent.id)).toEqual(["a2"])
        })
    })

    describe("handoversOf", () => {
        it("lists the bound agents of other modules", async () => {
            const { service } = await build(mockEntityManager({ query: [LIST_AGENTS_OF_CONNECTION, AGENT_ROWS] }))

            const handovers = await service.handoversOf("c1", { module: "chatbot" })

            expect(handovers.map((agent) => agent.id)).toEqual(["a2"])
        })

        it("hands over to nobody for a conversation without a connection", async () => {
            const em = mockEntityManager()
            const { service } = await build(em)

            await expect(service.handoversOf(null, { module: "chatbot" })).resolves.toEqual([])
            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("grant", () => {
        const grant = {
            workspaceId: "w1",
            agentId: "a1",
            connectionId: "c1",
            purpose: "inbound_chat" as const,
            access: "ask" as const,
        }

        it("lets a manager grant a connection to an agent of the workspace", async () => {
            const em = mockEntityManager({ query: [UPSERT_BINDING, [{ agent_id: "a1" }]] })
            const { service, members } = await build(em)

            await service.grant("u1", grant)

            expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
            expect(em.query).toHaveBeenCalledWith(UPSERT_BINDING, ["a1", "c1", "w1", "inbound_chat", "ask"])
        })

        it("refuses an agent or connection that is not in the workspace", async () => {
            const { service } = await build(mockEntityManager({ query: [UPSERT_BINDING, []] }))

            await expect(service.grant("u1", grant)).rejects.toMatchObject({
                code: AgentsErrorCode.BindingTargetNotFound,
                params: { agentId: "a1", connectionId: "c1" },
            })
        })

        it("writes nothing for someone who is not a manager", async () => {
            const em = mockEntityManager()
            const { service, members } = await build(em)
            const refusal = new Error("not a manager")
            members.require.mockRejectedValue(refusal)

            await expect(service.grant("u1", grant)).rejects.toBe(refusal)
            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("revoke", () => {
        it("removes the grant for a manager", async () => {
            const em = mockEntityManager({ query: [DELETE_BINDING, []] })
            const { service, members } = await build(em)

            await service.revoke("u1", { workspaceId: "w1", agentId: "a1", connectionId: "c1" })

            expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
            expect(em.query).toHaveBeenCalledWith(DELETE_BINDING, ["a1", "c1", "w1"])
        })
    })
})
