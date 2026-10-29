import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, Not } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { McpToolGrantRecord, McpToolGrantView } from "./mcp-tool-grants.contracts"
import { McpToolGrantsService } from "./mcp-tool-grants.service"
import { McpToolGrantEntity } from "./persistence/entities"

/** Matches the `() => "now()"` function a write hands the database for a time column. */
const ANY_FUNCTION: unknown = expect.any(Function)

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

/** The agents the agents owner finds, by workspace and id: `ws-1:agent-1` is the AI Sales agent of workspace ws-1. */
const FOUND: Record<string, string> = {
    "ws-1:agent-1": "AI Sales",
    "ws-1:agent-2": "AI Care",
    "ws-2:agent-3": "AI Shifts",
}

const build = async (entityManager: MockEntityManager) => {
    const agents = mock<AgentDirectoryService>({
        cardsOf: jest.fn((workspaceId: string, ids: ReadonlyArray<string>) =>
            Promise.resolve(
                ids.flatMap((id) => {
                    const name = FOUND[`${workspaceId}:${id}`]
                    return name === undefined ? [] : [{ id, name, module: "sales", canTagAgentIds: [] }]
                }),
            ),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            McpToolGrantsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return Object.assign(moduleRef.get(McpToolGrantsService), { doubles: { agents } })
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

    it("lists every grant of the workspace with the agent's name, by name and then tool, leaving out an agent that is gone", async () => {
        const em = mockEntityManager({
            find: [
                McpToolGrantEntity,
                [
                    Object.assign(entityOf(), { agentId: "agent-2", tool: "a.tool" }),
                    Object.assign(entityOf(), { agentId: "agent-1", tool: "b.tool" }),
                    Object.assign(entityOf(), { agentId: "agent-1", tool: "c.tool" }),
                    Object.assign(entityOf(), { agentId: "agent-gone", tool: "d.tool" }),
                ],
            ],
        })
        const grants = await build(em)

        const listed = await grants.listOfWorkspace("ws-1")

        expect(listed.map((grant) => [grant.agent_name, grant.tool])).toEqual([
            ["AI Care", "a.tool"],
            ["AI Sales", "b.tool"],
            ["AI Sales", "c.tool"],
        ])
        expect(listed[1]).toEqual({ ...grantOf(), tool: "b.tool", agent_id: "agent-1", agent_name: "AI Sales" })
        expect(grants.doubles.agents.cardsOf).toHaveBeenCalledWith("ws-1", ["agent-2", "agent-1", "agent-gone"])
        expect(em.find).toHaveBeenCalledWith(McpToolGrantEntity, {
            select: { agentId: true, tool: true, mode: true, limitVnd: true, constraints: true },
            where: { workspaceId: "ws-1" },
            order: { tool: "ASC" },
            take: 500,
        })
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
        const em = mockEntityManager({ upsert: [McpToolGrantEntity, {}] })
        const grants = await build(em)

        await expect(grants.set({ ...recordOf({ limitVnd: 500000 }), updatedBy: "person-1" })).resolves.toBe(true)
        expect(em.upsert).toHaveBeenCalledWith(
            McpToolGrantEntity,
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                tool: "hakuen.booking.confirm",
                mode: "auto",
                limitVnd: 500000,
                constraints: [{ arg: "discountPct", max: 5 }],
                updatedBy: "person-1",
                updatedAt: ANY_FUNCTION,
            },
            ["agentId", "tool"],
        )
    })

    it("answers false and writes nothing when the agent is not one of the workspace", async () => {
        const em = mockEntityManager()
        const grants = await build(em)

        await expect(grants.set({ ...recordOf({ workspaceId: "ws-other" }), updatedBy: "person-1" })).resolves.toBe(
            false,
        )
        expect(em.upsert).not.toHaveBeenCalled()
    })

    it("answers false when the agent does not exist", async () => {
        const em = mockEntityManager()
        const grants = await build(em)

        await expect(grants.set({ ...recordOf({ agentId: "ghost" }), updatedBy: "person-1" })).resolves.toBe(false)
    })
})

describe("McpToolGrantsService.upsert", () => {
    it("writes many grants in one statement, the last record of an agent and tool winning", async () => {
        const em = mockEntityManager({ upsert: [McpToolGrantEntity, {}] })
        const grants = await build(em)

        await expect(
            grants.upsert([
                recordOf({ mode: "ask" }),
                recordOf({ tool: "sepay.*", constraints: [] }),
                recordOf({ mode: "never" }),
            ]),
        ).resolves.toBe(2)
        expect(grants.doubles.agents.cardsOf).toHaveBeenCalledTimes(1)
        expect(grants.doubles.agents.cardsOf).toHaveBeenCalledWith("ws-1", ["agent-1"])
        expect(em.upsert).toHaveBeenCalledWith(
            McpToolGrantEntity,
            [
                {
                    workspaceId: "ws-1",
                    agentId: "agent-1",
                    tool: "hakuen.booking.confirm",
                    mode: "never",
                    limitVnd: null,
                    constraints: [{ arg: "discountPct", max: 5 }],
                    updatedBy: null,
                    updatedAt: ANY_FUNCTION,
                },
                {
                    workspaceId: "ws-1",
                    agentId: "agent-1",
                    tool: "sepay.*",
                    mode: "auto",
                    limitVnd: null,
                    constraints: [],
                    updatedBy: null,
                    updatedAt: ANY_FUNCTION,
                },
            ],
            ["agentId", "tool"],
        )
    })

    it("skips a record whose agent is not of its workspace", async () => {
        const em = mockEntityManager({ upsert: [McpToolGrantEntity, {}] })
        const grants = await build(em)

        await expect(
            grants.upsert([
                recordOf(),
                recordOf({ agentId: "agent-3", tool: "sepay.*" }),
                recordOf({ workspaceId: "ws-2", agentId: "agent-3", tool: "einvoice.*" }),
            ]),
        ).resolves.toBe(2)
        expect(grants.doubles.agents.cardsOf).toHaveBeenCalledWith("ws-1", ["agent-1", "agent-3"])
        expect(grants.doubles.agents.cardsOf).toHaveBeenCalledWith("ws-2", ["agent-3"])
    })

    it("writes nothing when no record has an agent of its workspace", async () => {
        const em = mockEntityManager()
        const grants = await build(em)

        await expect(grants.upsert([recordOf({ agentId: "ghost" })])).resolves.toBe(0)
        expect(em.upsert).not.toHaveBeenCalled()
    })

    it("writes nothing for no records", async () => {
        const em = mockEntityManager()
        const grants = await build(em)

        await expect(grants.upsert([])).resolves.toBe(0)
        expect(grants.doubles.agents.cardsOf).not.toHaveBeenCalled()
    })
})
