import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentAccessLogService } from "@modules/domain/agent-access-log"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ConnectionGrantsService } from "./connection-grants.service"
import { ConnectionGrantsErrorCode } from "./errors/connection-grants.error"

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

interface Grant {
    readonly agentId: string
    readonly connectionId: string
    readonly access: string
}

/** The grants and agents the owners answer for one manager. */
const FACTS = new WeakMap<object, { grants: ReadonlyArray<Grant>; agents: ReadonlyArray<typeof AGENT> }>()

/** A manager whose scenario states the grants and the agents the owners answer. */
const managerOf = (grants: ReadonlyArray<Grant> = [], agents: ReadonlyArray<typeof AGENT> = [AGENT]) => {
    const em = mockEntityManager()
    FACTS.set(em, { grants, agents })
    return { em }
}

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
    const facts = FACTS.get(em) ?? { grants: [], agents: [] }
    const directory = mock<AgentDirectoryService>()
    directory.cardsOf.mockImplementation((_workspaceId, ids) =>
        Promise.resolve(
            facts.agents.filter((agent) => ids.includes(agent.id)).map((agent) => ({ ...agent, canTagAgentIds: [] })),
        ),
    )
    const bindings = mock<AgentBindingsService>()
    bindings.grantsOfWorkspace.mockResolvedValue([...facts.grants])
    bindings.grantsOfAgent.mockImplementation((_workspaceId, agentId) =>
        Promise.resolve(facts.grants.filter((grant) => grant.agentId === agentId)),
    )
    bindings.grantsOfConnection.mockImplementation((_workspaceId, connectionId) =>
        Promise.resolve(facts.grants.filter((grant) => grant.connectionId === connectionId)),
    )
    bindings.grantsAmong.mockImplementation((_workspaceId, agentIds, connectionIds) =>
        Promise.resolve(
            facts.grants.filter(
                (grant) => agentIds.includes(grant.agentId) && connectionIds.includes(grant.connectionId),
            ),
        ),
    )
    bindings.writeGrant.mockResolvedValue(undefined)
    bindings.removeGrant.mockResolvedValue(undefined)
    const accessLog = mock<AgentAccessLogService>()
    accessLog.record.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConnectionGrantsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: ConnectionsService, useValue: connections },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: AgentDirectoryService, useValue: directory },
            { provide: AgentAccessLogService, useValue: accessLog },
        ],
    }).compile()
    return { service: moduleRef.get(ConnectionGrantsService), tx, connections, bindings, accessLog, directory }
}

/** A grant write receives the transaction view, which is not the outer manager. */
const expectInTransaction = <Args extends Array<unknown>>(spy: jest.Mock<unknown, Args>, payload: object): void => {
    expect(spy).toHaveBeenCalledWith(payload, expect.anything())
    expect(isTransactionManager(spy.mock.calls[0]?.[1])).toBe(true)
}

const agentId = "11111111-1111-4111-8111-111111111111"

describe("ConnectionGrantsService > candidates", () => {
    it("lists every grantable connection with the access the agent already has", async () => {
        const { em } = managerOf([{ agentId, connectionId: "c1", access: "ask" }])
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

    it("refuses an id that is not an agent id before reading anything", async () => {
        const { service, directory } = await build(mockEntityManager())

        await expect(service.candidates("owner-1", "ws-1", "not-an-id")).rejects.toMatchObject({
            code: ConnectionsErrorCode.NotFound,
            params: { id: "not-an-id" },
        })
        expect(directory.cardsOf).not.toHaveBeenCalled()
    })
})

describe("ConnectionGrantsService > candidates", () => {
    it("treats a blank public fact as absent, an unknown level as auto, and no grant as none", async () => {
        const { em } = managerOf([{ agentId, connectionId: "c1", access: "nope" }])
        const { service } = await build(em, [
            connection({ id: "c1", meta: { bot_username: "  ", account_masked: "****1234" } }),
            connection({ id: "c2" }),
        ])

        await expect(service.candidates("owner-1", "ws-1", agentId)).resolves.toEqual([
            {
                id: "c1",
                name: "Shop bot",
                provider: "telegram",
                botUsername: null,
                accountMasked: "****1234",
                status: "connected",
                purpose: "inbound_chat",
                access: "auto",
            },
            {
                id: "c2",
                name: "Shop bot",
                provider: "telegram",
                botUsername: null,
                accountMasked: null,
                status: "connected",
                purpose: "inbound_chat",
                access: null,
            },
        ])
    })

    it("refuses an agent that is not in the workspace", async () => {
        const { em } = managerOf([], [])
        const { service } = await build(em)

        await expect(service.candidates("owner-1", "ws-1", agentId)).rejects.toMatchObject({
            code: ConnectionsErrorCode.NotFound,
        })
    })
})

describe("ConnectionGrantsService > setGrant", () => {
    it("gives an agent access, writes the grant with its purpose and logs who changed what", async () => {
        const { service, tx, connections, bindings, accessLog } = await build(managerOf().em)

        await service.setGrant(actor, "c1", "a1", "auto")

        expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
        expectInTransaction(bindings.writeGrant, {
            workspaceId: "ws-1",
            agentId: "a1",
            connectionId: "c1",
            purpose: "inbound_chat",
            access: "auto",
        })
        expectInTransaction(accessLog.record, {
            workspaceId: "ws-1",
            connectionId: "c1",
            agentId: "a1",
            connectionName: "Shop bot",
            agentName: "Bot",
            before: null,
            after: "auto",
            changedBy: "owner-1",
            changedByName: "Lan",
        })
        expect(tx.commits).toBe(1)
    })

    it("starts an unknown level at ask", async () => {
        const { service, bindings } = await build(managerOf().em)

        await service.setGrant(actor, "c1", "a1", "bogus")

        expectInTransaction(bindings.writeGrant, {
            workspaceId: "ws-1",
            agentId: "a1",
            connectionId: "c1",
            purpose: "inbound_chat",
            access: "ask",
        })
    })

    it("removes an access and logs the level it had", async () => {
        const { service, bindings, accessLog } = await build(
            managerOf([{ agentId: "a1", connectionId: "c1", access: "read" }]).em,
        )

        await service.setGrant(actor, "c1", "a1", null)

        expectInTransaction(bindings.removeGrant, { workspaceId: "ws-1", agentId: "a1", connectionId: "c1" })
        expect(accessLog.record.mock.calls[0]?.[0]).toMatchObject({ before: "read", after: null })
        expect(isTransactionManager(accessLog.record.mock.calls[0]?.[1])).toBe(true)
    })

    it("writes nothing when the level is already the one asked", async () => {
        const { service, bindings, accessLog } = await build(
            managerOf([{ agentId: "a1", connectionId: "c1", access: "ask" }]).em,
        )

        await service.setGrant(actor, "c1", "a1", "ask")

        expect(bindings.writeGrant).not.toHaveBeenCalled()
        expect(accessLog.record).not.toHaveBeenCalled()
    })
})

describe("ConnectionGrantsService > setGrant", () => {
    it("refuses a module that cannot use the provider", async () => {
        const { service, tx } = await build(managerOf().em, [connection({ provider: "sepay", name: "Bank" })])

        await expect(service.setGrant(actor, "c1", "a1", "ask")).rejects.toMatchObject({
            code: ConnectionGrantsErrorCode.PairRefused,
            params: { agent: "Bot", connection: "Bank" },
        })
        expect(tx.rollbacks).toBe(1)
    })

    it("refuses a first grant on a disconnected connection", async () => {
        const { service } = await build(managerOf().em, [connection({ status: "disconnected" })])

        await expect(service.setGrant(actor, "c1", "a1", "ask")).rejects.toMatchObject({
            code: ConnectionGrantsErrorCode.ConnectionDisconnected,
            params: { connection: "Shop bot" },
        })
    })

    it("lets an existing grant on a disconnected connection change level", async () => {
        const { service, bindings } = await build(
            managerOf([{ agentId: "a1", connectionId: "c1", access: "read" }]).em,
            [connection({ status: "disconnected" })],
        )

        await service.setGrant(actor, "c1", "a1", "auto")

        expectInTransaction(bindings.writeGrant, {
            workspaceId: "ws-1",
            agentId: "a1",
            connectionId: "c1",
            purpose: "inbound_chat",
            access: "auto",
        })
    })

    it("answers not found for an agent or a connection of another workspace", async () => {
        const noAgent = await build(managerOf([], []).em)
        const noConnection = await build(managerOf().em, [])

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
        const { service, tx, connections } = await build(managerOf().em)
        const refused = new Error("CONNECTIONS_FORBIDDEN")
        connections.authorize.mockRejectedValue(refused)

        await expect(service.setGrant(actor, "c1", "a1", "ask")).rejects.toBe(refused)
        expect(tx.outcomes).toEqual([])
    })
})

describe("ConnectionGrantsService > setConnectionAgents", () => {
    it("makes exactly these agents use the connection", async () => {
        const { service, connections, bindings } = await build(
            managerOf(
                [{ agentId: "gone", connectionId: "c1", access: "ask" }],
                [AGENT, { id: "gone", name: "Old", module: "chatbot" }],
            ).em,
        )

        await service.setConnectionAgents(actor, "c1", [{ agentId: "a1" }])

        expect(connections.get).toHaveBeenCalledWith("ws-1", "c1", expect.anything())
        expect(isTransactionManager(connections.get.mock.calls[0]?.[2])).toBe(true)
        expectInTransaction(bindings.writeGrant, {
            workspaceId: "ws-1",
            agentId: "a1",
            connectionId: "c1",
            purpose: "inbound_chat",
            access: "ask",
        })
        expectInTransaction(bindings.removeGrant, { workspaceId: "ws-1", agentId: "gone", connectionId: "c1" })
    })

    it("does nothing for a connection without agents when none are wanted", async () => {
        const { service, tx, bindings } = await build(managerOf().em)

        await service.setConnectionAgents(actor, "c1", [])

        expect(tx.commits).toBe(1)
        expect(bindings.grantsOfConnection).toHaveBeenCalledWith("ws-1", "c1", expect.anything())
        expect(isTransactionManager(bindings.grantsOfConnection.mock.calls[0]?.[2])).toBe(true)
        expect(bindings.writeGrant).not.toHaveBeenCalled()
        expect(bindings.removeGrant).not.toHaveBeenCalled()
    })
})

describe("ConnectionGrantsService > setAgentConnections", () => {
    it("makes exactly these connections used by the agent, keeping a level it already has", async () => {
        const { service, tx, bindings } = await build(
            managerOf([{ agentId: "a1", connectionId: "c1", access: "auto" }]).em,
        )

        await service.setAgentConnections(actor, "a1", [{ connectionId: "c1" }, { connectionId: "c1", access: "auto" }])

        expect(bindings.writeGrant).not.toHaveBeenCalled()
        expect(tx.commits).toBe(1)
    })

    it("adds a connection at the level the caller picks", async () => {
        const { service, bindings } = await build(managerOf().em)

        await service.setAgentConnections(actor, "a1", [{ connectionId: "c1", access: "read" }])

        expectInTransaction(bindings.writeGrant, {
            workspaceId: "ws-1",
            agentId: "a1",
            connectionId: "c1",
            purpose: "inbound_chat",
            access: "read",
        })
    })
})

describe("ConnectionGrantsService > board", () => {
    it("lists every connection with the agents that use it", async () => {
        const shop = connection({ meta: { bot_username: "shop_bot" } })
        const bank = connection({ id: "c2", provider: "sepay", name: "Bank", meta: { account_masked: "" } })
        const { em } = managerOf([
            { agentId: "a1", connectionId: "c1", access: "read" },
            { agentId: "a2", connectionId: "c1", access: "nope" },
            { agentId: "a3", connectionId: "missing", access: "ask" },
        ])
        const { service, connections, bindings } = await build(em, [shop, bank])

        await expect(service.board(actor)).resolves.toEqual([
            {
                connection: shop,
                botUsername: "shop_bot",
                accountMasked: null,
                grants: [
                    { agentId: "a1", access: "read" },
                    { agentId: "a2", access: "auto" },
                ],
            },
            { connection: bank, botUsername: null, accountMasked: null, grants: [] },
        ])
        expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner", "manager"])
        expect(connections.list).toHaveBeenCalledWith("ws-1")
        expect(bindings.grantsOfWorkspace).toHaveBeenCalledWith("ws-1")
    })
})
