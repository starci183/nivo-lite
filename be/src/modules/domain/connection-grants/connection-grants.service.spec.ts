import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ConnectionGrantsService } from "./connection-grants.service"
import { ConnectionGrantsErrorCode } from "./errors/connection-grants.error"
import {
    DELETE_GRANT,
    FIND_AGENT_GRANTS,
    FIND_AGENTS,
    FIND_CONNECTION_GRANTS,
    FIND_GRANTS,
    INSERT_ACCESS_LOG,
    UPSERT_GRANT,
} from "./persistence/connection-grants.sql"

const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "ws-1" }
const AGENT = { id: "a1", name: "Bot", module: "chatbot" }
const connection = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: "c1",
    workspaceId: "ws-1",
    provider: "telegram",
    name: "Shop bot",
    meta: {},
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
})

const build = async (em: MockEntityManager, found: ReadonlyArray<ConnectionRecord> = [connection()]) => {
    const tx = fakeTransaction(em)
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.findMany.mockResolvedValue(found)
    connections.get.mockResolvedValue(connection())
    connections.list.mockResolvedValue(found)
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "owner-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionGrantsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: ConnectionsService, useValue: connections },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionGrantsService), tx, connections }
}

const lookups = (grants: ReadonlyArray<{ agent_id: string; connection_id: string; access: string }> = []) =>
    mockEntityManager({
        query: [
            [FIND_AGENTS, [AGENT]],
            [FIND_GRANTS, grants],
            [UPSERT_GRANT, []],
            [DELETE_GRANT, []],
            [INSERT_ACCESS_LOG, []],
        ],
    })

describe("ConnectionGrantsService", () => {
    describe("candidates", () => {
        const agentId = "11111111-1111-4111-8111-111111111111"

        it("lists every grantable connection with the access the agent already has", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_AGENTS, [AGENT]],
                    [FIND_AGENT_GRANTS, [{ agent_id: agentId, connection_id: "c1", access: "ask" }]],
                ],
            })
            const { service, connections } = await build(em, [
                connection({ id: "c1", meta: { bot_username: "shop_bot" } }),
                connection({ id: "c2", provider: "sepay", meta: { account_masked: "****1234" } }),
                connection({ id: "c3", status: "disconnected" }),
            ])

            await expect(service.candidates("owner-1", "ws-1", agentId)).resolves.toEqual([
                {
                    id: "c1",
                    name: "Shop bot",
                    provider: "telegram",
                    botUsername: "shop_bot",
                    accountMasked: null,
                    status: "connected",
                    purpose: "inbound_chat",
                    access: "ask",
                },
            ])
            expect(connections.list).toHaveBeenCalledWith("ws-1")
        })

        it("refuses an agent that is not in the workspace", async () => {
            const em = mockEntityManager({ query: [FIND_AGENTS, []] })
            const { service } = await build(em)

            await expect(service.candidates("owner-1", "ws-1", agentId)).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
            })
        })
    })

    describe("setGrant", () => {
        it("gives an agent access, writes the grant with its purpose and logs who changed what", async () => {
            const { service, tx, connections } = await build(lookups())

            await service.setGrant(actor, "c1", "a1", "auto")

            expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
            expect(tx.em.query).toHaveBeenCalledWith(UPSERT_GRANT, ["a1", "c1", "ws-1", "inbound_chat", "auto"])
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_ACCESS_LOG, [
                "ws-1",
                "c1",
                "a1",
                "Shop bot",
                "Bot",
                null,
                "auto",
                "owner-1",
                "Lan",
            ])
            expect(tx.commits).toBe(1)
        })

        it("starts an unknown level at ask", async () => {
            const { service, tx } = await build(lookups())

            await service.setGrant(actor, "c1", "a1", "bogus")

            expect(tx.em.query).toHaveBeenCalledWith(UPSERT_GRANT, ["a1", "c1", "ws-1", "inbound_chat", "ask"])
        })

        it("removes an access and logs the level it had", async () => {
            const { service, tx } = await build(lookups([{ agent_id: "a1", connection_id: "c1", access: "read" }]))

            await service.setGrant(actor, "c1", "a1", null)

            expect(tx.em.query).toHaveBeenCalledWith(DELETE_GRANT, ["ws-1", "a1", "c1"])
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_ACCESS_LOG, expect.arrayContaining(["read", null]))
        })

        it("writes nothing when the level is already the one asked", async () => {
            const { service, tx } = await build(lookups([{ agent_id: "a1", connection_id: "c1", access: "ask" }]))

            await service.setGrant(actor, "c1", "a1", "ask")

            expect(tx.em.query).not.toHaveBeenCalledWith(UPSERT_GRANT, expect.anything())
            expect(tx.em.query).not.toHaveBeenCalledWith(INSERT_ACCESS_LOG, expect.anything())
        })

        it("refuses a module that cannot use the provider", async () => {
            const { service, tx } = await build(lookups(), [connection({ provider: "sepay", name: "Bank" })])

            await expect(service.setGrant(actor, "c1", "a1", "ask")).rejects.toMatchObject({
                code: ConnectionGrantsErrorCode.PairRefused,
                params: { agent: "Bot", connection: "Bank" },
            })
            expect(tx.rollbacks).toBe(1)
        })

        it("refuses a first grant on a disconnected connection", async () => {
            const { service } = await build(lookups(), [connection({ status: "disconnected" })])

            await expect(service.setGrant(actor, "c1", "a1", "ask")).rejects.toMatchObject({
                code: ConnectionGrantsErrorCode.ConnectionDisconnected,
                params: { connection: "Shop bot" },
            })
        })

        it("lets an existing grant on a disconnected connection change level", async () => {
            const { service, tx } = await build(lookups([{ agent_id: "a1", connection_id: "c1", access: "read" }]), [
                connection({ status: "disconnected" }),
            ])

            await service.setGrant(actor, "c1", "a1", "auto")

            expect(tx.em.query).toHaveBeenCalledWith(UPSERT_GRANT, expect.anything())
        })

        it("answers not found for an agent or a connection of another workspace", async () => {
            const noAgent = await build(
                mockEntityManager({
                    query: [
                        [FIND_AGENTS, []],
                        [FIND_GRANTS, []],
                    ],
                }),
            )
            const noConnection = await build(lookups(), [])

            await expect(noAgent.service.setGrant(actor, "c1", "a1", "ask")).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
                params: { id: "a1" },
            })
            await expect(noConnection.service.setGrant(actor, "c1", "a1", "ask")).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
                params: { id: "c1" },
            })
        })

        it("stops before any write when the caller is not the owner", async () => {
            const { service, tx, connections } = await build(lookups())
            const refused = new Error("CONNECTIONS_FORBIDDEN")
            connections.authorize.mockRejectedValue(refused)

            await expect(service.setGrant(actor, "c1", "a1", "ask")).rejects.toBe(refused)
            expect(tx.outcomes).toEqual([])
        })
    })

    describe("setConnectionAgents", () => {
        it("makes exactly these agents use the connection", async () => {
            const { service, tx, connections } = await build(
                mockEntityManager({
                    query: [
                        [FIND_CONNECTION_GRANTS, [{ agent_id: "gone", connection_id: "c1", access: "ask" }]],
                        [FIND_AGENTS, [AGENT, { id: "gone", name: "Old", module: "chatbot" }]],
                        [FIND_GRANTS, [{ agent_id: "gone", connection_id: "c1", access: "ask" }]],
                        [UPSERT_GRANT, []],
                        [DELETE_GRANT, []],
                        [INSERT_ACCESS_LOG, []],
                    ],
                }),
            )

            await service.setConnectionAgents(actor, "c1", [{ agentId: "a1" }])

            expect(connections.get).toHaveBeenCalledWith("ws-1", "c1", expect.anything())
            expect(tx.em.query).toHaveBeenCalledWith(UPSERT_GRANT, ["a1", "c1", "ws-1", "inbound_chat", "ask"])
            expect(tx.em.query).toHaveBeenCalledWith(DELETE_GRANT, ["ws-1", "gone", "c1"])
        })

        it("does nothing for a connection without agents when none are wanted", async () => {
            const { service, tx } = await build(mockEntityManager({ query: [FIND_CONNECTION_GRANTS, []] }))

            await service.setConnectionAgents(actor, "c1", [])

            expect(tx.commits).toBe(1)
            expect(tx.em.query).toHaveBeenCalledTimes(1)
        })
    })

    describe("setAgentConnections", () => {
        it("makes exactly these connections used by the agent, keeping a level it already has", async () => {
            const { service, tx } = await build(
                mockEntityManager({
                    query: [
                        [FIND_AGENT_GRANTS, [{ agent_id: "a1", connection_id: "c1", access: "auto" }]],
                        [FIND_AGENTS, [AGENT]],
                        [FIND_GRANTS, [{ agent_id: "a1", connection_id: "c1", access: "auto" }]],
                        [UPSERT_GRANT, []],
                        [INSERT_ACCESS_LOG, []],
                    ],
                }),
            )

            await service.setAgentConnections(actor, "a1", [
                { connectionId: "c1" },
                { connectionId: "c1", access: "auto" },
            ])

            expect(tx.em.query).not.toHaveBeenCalledWith(UPSERT_GRANT, expect.anything())
            expect(tx.commits).toBe(1)
        })

        it("adds a connection at the level the caller picks", async () => {
            const { service, tx } = await build(
                mockEntityManager({
                    query: [
                        [FIND_AGENT_GRANTS, []],
                        [FIND_AGENTS, [AGENT]],
                        [FIND_GRANTS, []],
                        [UPSERT_GRANT, []],
                        [INSERT_ACCESS_LOG, []],
                    ],
                }),
            )

            await service.setAgentConnections(actor, "a1", [{ connectionId: "c1", access: "read" }])

            expect(tx.em.query).toHaveBeenCalledWith(UPSERT_GRANT, ["a1", "c1", "ws-1", "inbound_chat", "read"])
        })
    })
})
