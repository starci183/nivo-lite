import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { McpToolGrantRecord, McpToolGrantView, McpWorkspaceGrantView } from "./mcp-tool-grants.contracts"
import { McpToolGrantsService } from "./mcp-tool-grants.service"
import { McpToolGrantEntity } from "./persistence/entities"

/** The first upsert the manager was asked for: entity, rows as written and conflict keys. */
const upsertedOf = (em: MockEntityManager): ReadonlyArray<unknown> => {
    const [entity, rows, keys] = em.upsert.mock.calls[0] ?? []
    return [entity, Array.isArray(rows) ? rows.map(evaluatedValues) : evaluatedValues(rows), keys]
}

const grantOf = builder<McpToolGrantView>({ tool: "hakuen.*", mode: "auto", limit_vnd: null, constraints: [] })

const entityOf = builder<McpToolGrantEntity>({
    id: "grant-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    tool: "hakuen.*",
    mode: "auto",
    limitVnd: null,
    constraints: [],
    updatedBy: null,
    updatedAt: new Date("2026-10-20T00:00:00.000Z"),
})

const recordOf = builder<McpToolGrantRecord>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    tool: "hakuen.booking.confirm",
    mode: "auto",
    limitVnd: null,
    constraints: [{ arg: "discountPct", max: 5 }],
})

/** One grant row as written to the database, with any column overridden. */
const writtenOf = builder<Record<string, unknown>>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    tool: "hakuen.booking.confirm",
    mode: "auto",
    limitVnd: null,
    constraints: [{ arg: "discountPct", max: 5 }],
    updatedBy: null,
    updatedAt: "now()",
})

const build = async (entityManager: MockEntityManager): Promise<McpToolGrantsService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [McpToolGrantsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(McpToolGrantsService)
}

/** A manager whose query builder answers the given raw rows. */
const managerAnswering = (em: MockEntityManager, rows: ReadonlyArray<unknown>) => {
    const [fake] = queueQueryBuilders(em, [{ getRawMany: rows }])
    return { em, fake }
}

describe("McpToolGrantsService reads", () => {
    it("lists the grants of one agent of the workspace", async () => {
        const em = mockEntityManager({ find: [McpToolGrantEntity, [entityOf()]] })
        const grants = await build(em)

        await expect(grants.listOfAgent("ws-1", "agent-1")).resolves.toEqual([grantOf()])
        expect(em.find).toHaveBeenCalledWith(McpToolGrantEntity, {
            select: { tool: true, mode: true, limitVnd: true, constraints: true },
            where: { workspaceId: "ws-1", agentId: "agent-1" },
            order: { tool: "ASC" },
            take: 500,
        })
    })

    it("lists every grant of the workspace with the agent's name", async () => {
        const row: McpWorkspaceGrantView = { ...grantOf(), agent_id: "agent-1", agent_name: "AI Sales" }
        const { em, fake } = managerAnswering(mockEntityManager(), [row])
        const grants = await build(em)

        await expect(grants.listOfWorkspace("ws-1")).resolves.toEqual([row])
        expect(fake?.callsOf("innerJoin")).toEqual([["agents", "a", "a.id = g.agent_id"]])
        expect(fake?.callsOf("where")).toEqual([["g.workspace_id = :workspaceId", { workspaceId: "ws-1" }]])
        expect(fake?.callsOf("orderBy")).toEqual([["a.name", "ASC"]])
        expect(fake?.callsOf("addOrderBy")).toEqual([["g.tool", "ASC"]])
        expect(fake?.callsOf("limit")).toEqual([[500]])
    })

    it("answers each granted agent once, in grant order", async () => {
        const em = mockEntityManager({
            find: [
                McpToolGrantEntity,
                [
                    Object.assign(entityOf(), { agentId: "agent-2" }),
                    Object.assign(entityOf(), { agentId: "agent-1" }),
                    Object.assign(entityOf(), { agentId: "agent-2" }),
                ],
            ],
        })
        const grants = await build(em)

        await expect(grants.agentsGranted("ws-1", ["sepay.*", "einvoice.list"])).resolves.toEqual([
            "agent-2",
            "agent-1",
        ])
        expect(em.find).toHaveBeenCalledWith(McpToolGrantEntity, {
            select: { agentId: true },
            where: { workspaceId: "ws-1", tool: In(["sepay.*", "einvoice.list"]), mode: Not("never") },
            order: { updatedAt: "ASC" },
            take: 500,
        })
    })
})

describe("McpToolGrantsService.set", () => {
    it("sets the grant with its constraints and the person who set it", async () => {
        const { em } = managerAnswering(mockEntityManager({ upsert: [McpToolGrantEntity, {}] }), [
            { id: "agent-1", workspace_id: "ws-1" },
        ])
        const grants = await build(em)

        await expect(grants.set({ ...recordOf({ limitVnd: 500000 }), updatedBy: "person-1" })).resolves.toBe(true)
        expect(upsertedOf(em)).toEqual([
            McpToolGrantEntity,
            writtenOf({ limitVnd: 500000, updatedBy: "person-1" }),
            ["agentId", "tool"],
        ])
    })

    it("answers false and writes nothing when the agent is not one of the workspace", async () => {
        const { em } = managerAnswering(mockEntityManager(), [{ id: "agent-1", workspace_id: "ws-other" }])
        const grants = await build(em)

        await expect(grants.set({ ...recordOf(), updatedBy: "person-1" })).resolves.toBe(false)
        expect(em.upsert).not.toHaveBeenCalled()
    })

    it("answers false when the agent does not exist", async () => {
        const { em } = managerAnswering(mockEntityManager(), [])
        const grants = await build(em)

        await expect(grants.set({ ...recordOf(), updatedBy: "person-1" })).resolves.toBe(false)
    })
})

describe("McpToolGrantsService.upsert", () => {
    it("writes many grants in one statement, the last record of an agent and tool winning", async () => {
        const { em, fake } = managerAnswering(mockEntityManager({ upsert: [McpToolGrantEntity, {}] }), [
            { id: "agent-1", workspace_id: "ws-1" },
        ])
        const grants = await build(em)

        await expect(
            grants.upsert([
                recordOf({ mode: "ask" }),
                recordOf({ tool: "sepay.*", constraints: [] }),
                recordOf({ mode: "never" }),
            ]),
        ).resolves.toBe(2)
        expect(fake?.callsOf("where")).toEqual([["a.id IN (:...agentIds)", { agentIds: ["agent-1"] }]])
        expect(upsertedOf(em)).toEqual([
            McpToolGrantEntity,
            [writtenOf({ mode: "never" }), writtenOf({ tool: "sepay.*", constraints: [] })],
            ["agentId", "tool"],
        ])
    })

    it("skips a record whose agent is not of its workspace", async () => {
        const { em } = managerAnswering(mockEntityManager({ upsert: [McpToolGrantEntity, {}] }), [
            { id: "agent-1", workspace_id: "ws-1" },
            { id: "agent-2", workspace_id: "ws-other" },
        ])
        const grants = await build(em)

        await expect(grants.upsert([recordOf(), recordOf({ agentId: "agent-2" })])).resolves.toBe(1)
    })

    it("writes nothing when no record has an agent of its workspace", async () => {
        const { em } = managerAnswering(mockEntityManager(), [])
        const grants = await build(em)

        await expect(grants.upsert([recordOf()])).resolves.toBe(0)
        expect(em.upsert).not.toHaveBeenCalled()
    })

    it("writes nothing for no records", async () => {
        const em = mockEntityManager()
        const grants = await build(em)

        await expect(grants.upsert([])).resolves.toBe(0)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
