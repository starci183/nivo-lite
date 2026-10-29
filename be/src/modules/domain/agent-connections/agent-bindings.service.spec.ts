import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentBindingsService } from "./agent-bindings.service"
import { AgentConnectionsErrorCode } from "./errors/agent-connections.error"
import { AgentConnectionEntity } from "./persistence/entities"

const AGENT_ROWS = [
    {
        id: "a2",
        module: "booking",
        name: "Booker",
        created_at: new Date("2026-10-02T00:00:00.000Z"),
        access: "auto",
        purpose: "inbound_chat",
    },
    {
        id: "a1",
        module: "chatbot",
        name: "Bot",
        created_at: new Date("2026-10-01T00:00:00.000Z"),
        access: "auto",
        purpose: "inbound_chat",
    },
    {
        id: "a3",
        module: "sales",
        name: "Seller",
        created_at: new Date("2026-10-03T00:00:00.000Z"),
        access: "auto",
        purpose: "inbound_chat",
    },
]

/** A manager whose query builders answer these raw reads, in order. */
const reading = (...answers: Array<QueryBuilderAnswers>) => {
    const em = mockEntityManager()
    return { em, fakes: queueQueryBuilders(em, answers) }
}

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
            const { em, fakes } = reading({ getRawMany: AGENT_ROWS })
            const { service } = await build(em)

            const agents = await service.agentsFor("c1", ["inbound_chat", "tool"])

            expect(agents.map((agent) => agent.id)).toEqual(["a1", "a2", "a3"])
            expect(fakes[0]?.callsOf("where")).toEqual([
                [
                    "ac.connection_id = :connectionId AND ac.purpose = ANY(:purposes) AND a.status = 'active'",
                    { connectionId: "c1", purposes: ["inbound_chat", "tool"] },
                ],
            ])
            expect(fakes[0]?.callsOf("limit")).toEqual([[200]])
        })

        it("takes one purpose as a list of one", async () => {
            const { em, fakes } = reading({ getRawMany: [] })
            const { service } = await build(em)

            await service.agentsFor("c1", "inbound_chat", { acting: true })

            expect(fakes[0]?.callsOf("where")).toEqual([
                [
                    expect.stringContaining("ac.connection_id = :connectionId"),
                    { connectionId: "c1", purposes: ["inbound_chat"] },
                ],
            ])
        })
    })
})

describe("AgentBindingsService", () => {
    describe("connectionsFor", () => {
        it("includes pending read grants with the default options", async () => {
            const rows = [
                {
                    id: "c1",
                    provider: "telegram",
                    name: "Pending bot",
                    bot_username: "shop_bot",
                    account_masked: null,
                    status: "pending",
                    created_at: new Date("2026-10-01T00:00:00.000Z"),
                    access: "read",
                    purpose: "outbound_chat",
                },
            ]
            const { em, fakes } = reading({ getRawMany: rows })
            const { service } = await build(em)

            await expect(service.connectionsFor("a1", "outbound_chat")).resolves.toEqual([
                {
                    id: "c1",
                    provider: "telegram",
                    name: "Pending bot",
                    botUsername: "shop_bot",
                    accountMasked: null,
                    status: "pending",
                    access: "read",
                    purpose: "outbound_chat",
                },
            ])
            expect(fakes[0]?.callsOf("where")).toEqual([
                [
                    "ac.agent_id = :agentId AND ac.purpose = ANY(:purposes)",
                    { agentId: "a1", purposes: ["outbound_chat"] },
                ],
            ])
        })

        it("lists the connected connections of an agent", async () => {
            const rows = [
                {
                    id: "c1",
                    provider: "telegram",
                    name: "Shop bot",
                    status: "connected",
                    created_at: new Date("2026-10-01T00:00:00.000Z"),
                    access: "ask",
                    purpose: "outbound_chat",
                },
                {
                    id: "c2",
                    provider: "telegram",
                    name: "Old bot",
                    status: "disconnected",
                    created_at: new Date("2026-09-01T00:00:00.000Z"),
                    access: "ask",
                    purpose: "outbound_chat",
                },
            ]
            const { em, fakes } = reading({ getRawMany: rows })
            const { service } = await build(em)

            const connections = await service.connectionsFor("a1", "outbound_chat", { connectedOnly: true })

            expect(connections.map((connection) => connection.id)).toEqual(["c1"])
            expect(fakes[0]?.callsOf("limit")).toEqual([[200]])
        })
    })
})

describe("AgentBindingsService", () => {
    describe("connectionsOfAgent", () => {
        it("lists every connection of an agent of the workspace for a member, whatever the purpose", async () => {
            const rows = [
                {
                    id: "c1",
                    provider: "telegram",
                    name: "Shop bot",
                    status: "connected",
                    created_at: new Date("2026-10-01T00:00:00.000Z"),
                    access: "ask",
                    purpose: "tool",
                },
            ]
            const { em, fakes } = reading({ getRawMany: rows })
            const { service, members } = await build(em)

            const connections = await service.connectionsOfAgent("u1", "w1", "a1")

            expect(members.require).toHaveBeenCalledWith("u1", "w1")
            expect(connections.map((connection) => connection.id)).toEqual(["c1"])
            expect(fakes[0]?.callsOf("where")).toEqual([
                [
                    "ac.agent_id = :agentId AND ac.workspace_id = :workspaceId AND ac.purpose = ANY(:purposes)",
                    {
                        agentId: "a1",
                        workspaceId: "w1",
                        purposes: ["inbound_chat", "outbound_chat", "bank_feed", "data_source", "tool", "lead_source"],
                    },
                ],
            ])
        })

        it("reads nothing for someone who is not a member", async () => {
            const em = mockEntityManager()
            const { service, members } = await build(em)
            const refusal = new Error("not a member")
            members.require.mockRejectedValue(refusal)

            await expect(service.connectionsOfAgent("u1", "w1", "a1")).rejects.toBe(refusal)
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })

    describe("routeInbound", () => {
        it("makes the chatbot the front door and hands over to the booking agent", async () => {
            const { service } = await build(reading({ getRawMany: AGENT_ROWS }).em)

            const route = await service.routeInbound("c1")

            expect(route.front?.id).toBe("a1")
            expect(route.handovers.map((agent) => agent.id)).toEqual(["a2"])
        })
    })

    describe("handoversOf", () => {
        it("lists the bound agents of other modules", async () => {
            const { service } = await build(reading({ getRawMany: AGENT_ROWS }).em)

            const handovers = await service.handoversOf("c1", { module: "chatbot" })

            expect(handovers.map((agent) => agent.id)).toEqual(["a2"])
        })

        it("hands over to nobody for a conversation without a connection", async () => {
            const em = mockEntityManager()
            const { service } = await build(em)

            await expect(service.handoversOf(null, { module: "chatbot" })).resolves.toEqual([])
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
})

describe("AgentBindingsService", () => {
    describe("grant", () => {
        const grant = {
            workspaceId: "w1",
            agentId: "a1",
            connectionId: "c1",
            purpose: "inbound_chat" as const,
            access: "ask" as const,
        }

        it("lets a manager grant a connection to an agent of the workspace", async () => {
            const { em, fakes } = reading({ getRawOne: { id: "a1" } }, { execute: {} })
            fakeTransaction(em)
            const { service, members } = await build(em)

            await service.grant("u1", grant)

            expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
            expect(fakes[0]?.callsOf("setLock")).toEqual([["pessimistic_read"]])
            expect(fakes[0]?.callsOf("where")).toEqual([
                [
                    "a.id = :agentId AND c.id = :connectionId AND a.workspace_id = :workspaceId",
                    { agentId: "a1", connectionId: "c1", workspaceId: "w1" },
                ],
            ])
            expect(em.createQueryBuilder).toHaveBeenCalledWith(AgentConnectionEntity, "ac")
            expect(fakes[1]?.callsOf("values")).toEqual([
                [{ agentId: "a1", connectionId: "c1", workspaceId: "w1", purpose: "inbound_chat", access: "ask" }],
            ])
            expect(fakes[1]?.callsOf("orUpdate")).toEqual([
                [
                    ["purpose", "access"],
                    ["agent_id", "connection_id"],
                ],
            ])
        })

        it("refuses an agent or connection that is not in the workspace", async () => {
            const { em, fakes } = reading({ getRawOne: undefined })
            fakeTransaction(em)
            const { service } = await build(em)

            await expect(service.grant("u1", grant)).rejects.toMatchObject({
                code: AgentConnectionsErrorCode.TargetNotFound,
                params: { agentId: "a1", connectionId: "c1" },
            })
            expect(fakes[0]?.callsOf("insert")).toEqual([])
        })

        it("writes nothing for someone who is not a manager", async () => {
            const em = mockEntityManager()
            const { service, members } = await build(em)
            const refusal = new Error("not a manager")
            members.require.mockRejectedValue(refusal)

            await expect(service.grant("u1", grant)).rejects.toBe(refusal)
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
})

describe("AgentBindingsService", () => {
    describe("writeGrant", () => {
        const grant = {
            workspaceId: "w1",
            agentId: "a1",
            connectionId: "c1",
            purpose: "tool" as const,
            access: "auto" as const,
        }

        it("writes the proved grant with the primary manager by default", async () => {
            const { em, fakes } = reading({ getRawOne: { id: "a1" } }, { execute: {} })
            const { service, members } = await build(em)

            await expect(service.writeGrant(grant)).resolves.toBeUndefined()

            expect(fakes[1]?.callsOf("values")).toEqual([
                [{ agentId: "a1", connectionId: "c1", workspaceId: "w1", purpose: "tool", access: "auto" }],
            ])
            expect(members.require).not.toHaveBeenCalled()
        })

        it("writes the proved grant with the caller's transaction manager", async () => {
            const em = mockEntityManager()
            const { em: manager, fakes } = reading({ getRawOne: { id: "a1" } }, { execute: {} })
            const { service, members } = await build(em)

            await expect(service.writeGrant(grant, manager)).resolves.toBeUndefined()

            expect(fakes[1]?.callsOf("values")).toEqual([
                [{ agentId: "a1", connectionId: "c1", workspaceId: "w1", purpose: "tool", access: "auto" }],
            ])
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
            expect(members.require).not.toHaveBeenCalled()
        })
    })
})

const DELETED = { agentId: "a1", connectionId: "c1", workspaceId: "w1" }

describe("AgentBindingsService", () => {
    describe("removeGrant", () => {
        const target = { workspaceId: "w1", agentId: "a1", connectionId: "c1" }

        it("removes the proved grant with the primary manager by default", async () => {
            const em = mockEntityManager({ delete: [AgentConnectionEntity, {}] })
            const { service, members } = await build(em)

            await expect(service.removeGrant(target)).resolves.toBeUndefined()

            expect(em.delete).toHaveBeenCalledWith(AgentConnectionEntity, DELETED)
            expect(members.require).not.toHaveBeenCalled()
        })

        it("removes the proved grant with the caller's transaction manager", async () => {
            const em = mockEntityManager()
            const manager = mockEntityManager({ delete: [AgentConnectionEntity, {}] })
            const { service, members } = await build(em)

            await expect(service.removeGrant(target, manager)).resolves.toBeUndefined()

            expect(manager.delete).toHaveBeenCalledWith(AgentConnectionEntity, DELETED)
            expect(em.delete).not.toHaveBeenCalled()
            expect(members.require).not.toHaveBeenCalled()
        })
    })

    describe("revoke", () => {
        it("removes the grant for a manager", async () => {
            const em = mockEntityManager({ delete: [AgentConnectionEntity, {}] })
            const { service, members } = await build(em)

            await service.revoke("u1", { workspaceId: "w1", agentId: "a1", connectionId: "c1" })

            expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
            expect(em.delete).toHaveBeenCalledWith(AgentConnectionEntity, DELETED)
        })
    })
})
