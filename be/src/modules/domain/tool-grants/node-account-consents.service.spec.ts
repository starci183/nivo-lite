import { Test } from "@nestjs/testing"
import { FakeClock, builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { IsNull, type EntityManager } from "typeorm"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { NodeAccountPolicyKey, NodeAccountPolicyRecord } from "./tool-grants.contracts"
import { NodeAccountConsentsService } from "./node-account-consents.service"
import { NodeAccountPolicyEntity } from "./persistence/entities"

/** The arguments of a typeorm transaction: an isolation level first, or the work alone. */
type TransactionArguments = Parameters<EntityManager["transaction"]>

const NOW = "2026-11-12T03:00:00.000Z"
const AT = new Date(NOW)

const entityOf = builder<NodeAccountPolicyEntity>({
    id: "policy-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    workflowId: "wf-1",
    nodeKey: "ledger",
    connectionId: "conn-books",
    operation: "nivo.tool.ledger.entry.append",
    position: 0,
    mode: "auto",
    origin: "template",
    fromVersionId: "v-1",
    agreedBy: null,
    agreedAt: null,
    createdAt: AT,
    updatedAt: AT,
})

const recordOf = builder<NodeAccountPolicyRecord>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    workflowId: "wf-1",
    nodeKey: "ledger",
    connectionId: "conn-books",
    operation: "nivo.tool.ledger.entry.append",
    mode: "auto",
    origin: "template",
    fromVersionId: "v-2",
    agreedBy: null,
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeAccountConsentsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return moduleRef.get(NodeAccountConsentsService)
}

describe("NodeAccountConsentsService: the reads", () => {
    it("reads the rows of one workflow of an agent, and of a whole workspace", async () => {
        const entityManager = mockEntityManager({ find: [NodeAccountPolicyEntity, [entityOf()]] })
        const service = await build(entityManager)

        const rows = await service.listOfWorkflow("ws-1", "agent-1", "wf-1")
        await service.listOfWorkspace("ws-1")

        expect(rows).toEqual([
            {
                agentId: "agent-1",
                workflowId: "wf-1",
                nodeKey: "ledger",
                connectionId: "conn-books",
                operation: "nivo.tool.ledger.entry.append",
                mode: "auto",
                origin: "template",
            },
        ])
        expect(entityManager.find.mock.calls[0]?.[1]).toMatchObject({
            where: { workspaceId: "ws-1", agentId: "agent-1", workflowId: "wf-1" },
        })
        expect(entityManager.find.mock.calls[1]?.[1]).toMatchObject({ where: { workspaceId: "ws-1" } })
    })

    it("leaves out a row whose mode or origin is damaged: a damaged row grants nothing", async () => {
        const damaged = [
            Object.assign(entityOf({ id: "policy-2" }), { mode: "write" }),
            Object.assign(entityOf({ id: "policy-3" }), { origin: "seed" }),
        ]
        const entityManager = mockEntityManager({ find: [NodeAccountPolicyEntity, [entityOf(), ...damaged]] })
        const service = await build(entityManager)

        await expect(service.listOfWorkspace("ws-1")).resolves.toHaveLength(1)
    })
})

describe("NodeAccountConsentsService.record: the rows it writes", () => {
    it("only adds a row a template brings: a row that exists keeps its mode and who agreed it", async () => {
        const service = await build(mockEntityManager())
        const manager = mockEntityManager()
        const [fake] = queueQueryBuilders(manager, [{ execute: { raw: [{ id: "policy-9" }] } }])

        await expect(service.record(manager, [recordOf()])).resolves.toBe(1)

        expect(fake?.callsOf("orIgnore")).toEqual([[]])
        expect(fake?.callsOf("orUpdate")).toEqual([])
        expect(fake?.callsOf("values")[0]?.[0]).toEqual([
            expect.objectContaining({
                nodeKey: "ledger",
                mode: "auto",
                origin: "template",
                fromVersionId: "v-2",
                agreedBy: null,
                agreedAt: null,
            }),
        ])
    })

    it("writes the owner's row as agreed: added, or the row that exists moved to the agreed mode with who agreed and when", async () => {
        const service = await build(mockEntityManager())
        const manager = mockEntityManager()
        const [brought, agreed] = queueQueryBuilders(manager, [
            { execute: { raw: [] } },
            { execute: { raw: [{ id: "policy-1" }] } },
        ])
        const owner = recordOf({ origin: "owner", agreedBy: "member-1", mode: "auto" })

        await expect(service.record(manager, [recordOf({ nodeKey: "match" }), owner])).resolves.toBe(1)

        expect(brought?.callsOf("orIgnore")).toEqual([[]])
        expect(agreed?.callsOf("orUpdate")).toEqual([
            [
                ["mode", "origin", "agreed_by", "agreed_at"],
                ["agent_id", "workflow_id", "node_key", "connection_id", "operation"],
            ],
        ])
        expect(agreed?.callsOf("values")[0]?.[0]).toEqual([
            expect.objectContaining({ origin: "owner", agreedBy: "member-1", agreedAt: AT, mode: "auto" }),
        ])
    })

})

describe("NodeAccountConsentsService.record: the version of a row", () => {
    it("writes the owner's row that names no version without the version column: a null never takes a stamped row's version off", async () => {
        const service = await build(mockEntityManager())
        const manager = mockEntityManager()
        const [unversioned] = queueQueryBuilders(manager, [{ execute: { raw: [{ id: "policy-1" }] } }])
        const owner = recordOf({ origin: "owner", agreedBy: "member-1", fromVersionId: null })

        await expect(service.record(manager, [owner])).resolves.toBe(1)

        expect(unversioned?.callsOf("orIgnore")).toEqual([])
        expect(unversioned?.callsOf("orUpdate")).toEqual([
            [
                ["mode", "origin", "agreed_by", "agreed_at"],
                ["agent_id", "workflow_id", "node_key", "connection_id", "operation"],
            ],
        ])
        expect(unversioned?.callsOf("values")[0]?.[0]).toEqual([
            expect.objectContaining({ origin: "owner", agreedBy: "member-1", agreedAt: AT, fromVersionId: null }),
        ])
    })

    it("never sets the version of a row that exists, whether the owner's yes names a version or none: one upsert, set once", async () => {
        const service = await build(mockEntityManager())
        const manager = mockEntityManager()
        const [agreed] = queueQueryBuilders(manager, [{ execute: { raw: [{ id: "policy-1" }, { id: "policy-2" }] } }])
        const versioned = recordOf({ origin: "owner", agreedBy: "member-1" })
        const unstamped = recordOf({ origin: "owner", agreedBy: "member-1", nodeKey: "match", fromVersionId: null })

        await expect(service.record(manager, [unstamped, versioned])).resolves.toBe(2)

        expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(agreed?.callsOf("orUpdate")).toEqual([
            [
                ["mode", "origin", "agreed_by", "agreed_at"],
                ["agent_id", "workflow_id", "node_key", "connection_id", "operation"],
            ],
        ])
        // A NEW row takes the version of the yes that makes it: the value is in the insert, never in the update of a row that exists.
        expect(agreed?.callsOf("values")[0]?.[0]).toEqual([
            expect.objectContaining({ nodeKey: "match", fromVersionId: null }),
            expect.objectContaining({ nodeKey: "ledger", fromVersionId: "v-2" }),
        ])
    })

})

describe("NodeAccountConsentsService.record: the manager it writes on", () => {
    it("writes on the manager it is given, never on its own, and nothing for no record", async () => {
        const own = mockEntityManager()
        const service = await build(own)
        const manager = mockEntityManager()

        await expect(service.record(manager, [])).resolves.toBe(0)

        expect(manager.createQueryBuilder).not.toHaveBeenCalled()
        expect(own.createQueryBuilder).not.toHaveBeenCalled()
        expect(own.delete).not.toHaveBeenCalled()
    })

    it("opens the transaction of the primary database for a version and its rows", async () => {
        const own = mockEntityManager()
        const inside = mockEntityManager()
        own.transaction.mockImplementation(
            (first: TransactionArguments[0] | TransactionArguments[1], second?: TransactionArguments[1]) =>
                Promise.resolve((typeof first === "function" ? first : second)?.(inside)),
        )
        const service = await build(own)

        await expect(service.transaction((manager) => Promise.resolve(manager))).resolves.toBe(inside)

        expect(own.transaction).toHaveBeenCalledTimes(1)
    })
})

describe("NodeAccountConsentsService.stamp", () => {
    const keyOf = builder<NodeAccountPolicyKey>({
        workspaceId: "ws-1",
        agentId: "agent-1",
        workflowId: "wf-1",
        nodeKey: "ledger",
        connectionId: "conn-books",
        operation: "nivo.tool.ledger.entry.append",
    })

    /** The key of a row as the stamp selects it: the rows that name no version yet. */
    const unnamedOf = (key: NodeAccountPolicyKey): NodeAccountPolicyKey => Object.assign(key, { fromVersionId: IsNull() })

    it("names each row the version only while it names none, and answers how many rows it named", async () => {
        const own = mockEntityManager()
        const service = await build(own)
        const manager = mockEntityManager({
            update: [
                [NodeAccountPolicyEntity, { affected: 1 }],
                [NodeAccountPolicyEntity, { affected: 1 }],
            ],
        })
        const rows = [keyOf(), keyOf({ nodeKey: "match", connectionId: "conn-zalo" })]

        await expect(service.stamp(manager, rows, "wfv-9")).resolves.toBe(2)

        expect(manager.update.mock.calls).toEqual([
            [
                NodeAccountPolicyEntity,
                unnamedOf(keyOf()),
                { fromVersionId: "wfv-9" },
            ],
            [
                NodeAccountPolicyEntity,
                unnamedOf(keyOf({ nodeKey: "match", connectionId: "conn-zalo" })),
                { fromVersionId: "wfv-9" },
            ],
        ])
        expect(own.update).not.toHaveBeenCalled()
    })

    it("issues nothing for no row", async () => {
        const service = await build(mockEntityManager())
        const manager = mockEntityManager()

        await expect(service.stamp(manager, [], "wfv-9")).resolves.toBe(0)

        expect(manager.update).not.toHaveBeenCalled()
    })

    it("answers 0 when a second stamp finds every row already named a version", async () => {
        const service = await build(mockEntityManager())
        const manager = mockEntityManager({
            update: [
                [NodeAccountPolicyEntity, { affected: 1 }],
                [NodeAccountPolicyEntity, { affected: 0 }],
            ],
        })

        await expect(service.stamp(manager, [keyOf()], "wfv-9")).resolves.toBe(1)
        await expect(service.stamp(manager, [keyOf()], "wfv-10")).resolves.toBe(0)

        expect(manager.update).toHaveBeenCalledTimes(2)
        expect(manager.update.mock.calls[1]?.[1]).toEqual(unnamedOf(keyOf()))
    })
})
