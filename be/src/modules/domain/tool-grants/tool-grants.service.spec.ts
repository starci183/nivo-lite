import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ToolGrantView } from "./tool-grants.contracts"
import { ToolGrantsService } from "./tool-grants.service"
import { ToolGrantEntity } from "./persistence/entities"

const grantOf = builder<ToolGrantView>({ tool: "shop.*", mode: "auto", limit_vnd: null, constraints: [] })

const entityOf = builder<ToolGrantEntity>({
    id: "grant-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    tool: "shop.*",
    mode: "auto",
    limitVnd: null,
    constraints: [],
    updatedBy: null,
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-20T00:00:00.000Z"),
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
                    return name === undefined ? [] : [{ id, name, module: "sales" }]
                }),
            ),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ToolGrantsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return Object.assign(moduleRef.get(ToolGrantsService), { doubles: { agents } })
}

describe("ToolGrantsService reads", () => {
    it("lists the grants of one agent of the workspace", async () => {
        const em = mockEntityManager({ find: [ToolGrantEntity, [entityOf()]] })
        const grants = await build(em)

        await expect(grants.listOfAgent("ws-1", "agent-1")).resolves.toEqual([grantOf()])
        expect(em.find).toHaveBeenCalledWith(ToolGrantEntity, {
            select: { tool: true, mode: true, limitVnd: true, constraints: true },
            where: { workspaceId: "ws-1", agentId: "agent-1" },
            order: { tool: "ASC" },
            take: 500,
        })
    })

    it("lists every grant of the workspace with the agent's name, by name and then tool, leaving out an agent that is gone", async () => {
        const em = mockEntityManager({
            find: [
                ToolGrantEntity,
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
        expect(em.find).toHaveBeenCalledWith(ToolGrantEntity, {
            select: { agentId: true, tool: true, mode: true, limitVnd: true, constraints: true },
            where: { workspaceId: "ws-1" },
            order: { tool: "ASC" },
            take: 500,
        })
    })

    it("answers each granted agent once, in grant order", async () => {
        const em = mockEntityManager({
            find: [
                ToolGrantEntity,
                [
                    Object.assign(entityOf(), { agentId: "agent-2" }),
                    Object.assign(entityOf(), { agentId: "agent-1" }),
                    Object.assign(entityOf(), { agentId: "agent-2" }),
                ],
            ],
        })
        const grants = await build(em)

        await expect(grants.agentsGranted("ws-1", ["nivo.tool.payment.*", "nivo.tool.einvoice.list"])).resolves.toEqual([
            "agent-2",
            "agent-1",
        ])
        expect(em.find).toHaveBeenCalledWith(ToolGrantEntity, {
            select: { agentId: true },
            where: { workspaceId: "ws-1", tool: In(["nivo.tool.payment.*", "nivo.tool.einvoice.list"]), mode: In(["auto", "ask"]) },
            order: { updatedAt: "ASC" },
            take: 500,
        })
    })
})
