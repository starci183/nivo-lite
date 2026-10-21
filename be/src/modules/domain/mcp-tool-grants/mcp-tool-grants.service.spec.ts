import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { McpToolGrantRecord } from "./mcp-tool-grants.contracts"
import { McpToolGrantsService } from "./mcp-tool-grants.service"
import type { McpToolGrantRow, McpWorkspaceGrantRow } from "./persistence/mcp-tool-grants.rows"
import {
    AGENTS_GRANTED,
    LIST_AGENT_GRANTS,
    LIST_WORKSPACE_GRANTS,
    UPSERT_GRANT,
    UPSERT_GRANTS,
} from "./persistence/mcp-tool-grants.sql"

const grantOf = builder<McpToolGrantRow>({ tool: "hakuen.*", mode: "auto", limit_vnd: null, constraints: [] })

const recordOf = builder<McpToolGrantRecord>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    tool: "hakuen.booking.confirm",
    mode: "auto",
    limitVnd: null,
    constraints: [{ arg: "discountPct", max: 5 }],
})

const build = async (entityManager: MockEntityManager): Promise<McpToolGrantsService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [McpToolGrantsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(McpToolGrantsService)
}

describe("McpToolGrantsService reads", () => {
    it("lists the grants of one agent of the workspace", async () => {
        const em = mockEntityManager({ query: [LIST_AGENT_GRANTS, [grantOf()]] })
        const grants = await build(em)

        await expect(grants.listOfAgent("ws-1", "agent-1")).resolves.toEqual([grantOf()])
        expect(em.query).toHaveBeenCalledWith(LIST_AGENT_GRANTS, ["ws-1", "agent-1"])
    })

    it("lists every grant of the workspace with the agent's name", async () => {
        const row: McpWorkspaceGrantRow = { ...grantOf(), agent_id: "agent-1", agent_name: "AI Sales" }
        const em = mockEntityManager({ query: [LIST_WORKSPACE_GRANTS, [row]] })
        const grants = await build(em)

        await expect(grants.listOfWorkspace("ws-1")).resolves.toEqual([row])
        expect(em.query).toHaveBeenCalledWith(LIST_WORKSPACE_GRANTS, ["ws-1"])
    })

    it("answers each granted agent once, in grant order", async () => {
        const em = mockEntityManager({
            query: [AGENTS_GRANTED, [{ agent_id: "agent-2" }, { agent_id: "agent-1" }, { agent_id: "agent-2" }]],
        })
        const grants = await build(em)

        await expect(grants.agentsGranted("ws-1", ["sepay.*", "einvoice.list"])).resolves.toEqual([
            "agent-2",
            "agent-1",
        ])
        expect(em.query).toHaveBeenCalledWith(AGENTS_GRANTED, ["ws-1", ["sepay.*", "einvoice.list"]])
    })
})

describe("McpToolGrantsService.set", () => {
    it("sets the grant with its constraints as JSON and the person who set it", async () => {
        const em = mockEntityManager({ query: [UPSERT_GRANT, [{ id: "grant-1" }]] })
        const grants = await build(em)

        await expect(grants.set({ ...recordOf({ limitVnd: 500000 }), updatedBy: "person-1" })).resolves.toBe(true)
        expect(em.query).toHaveBeenCalledWith(UPSERT_GRANT, [
            "ws-1",
            "agent-1",
            "hakuen.booking.confirm",
            "auto",
            500000,
            '[{"arg":"discountPct","max":5}]',
            "person-1",
        ])
    })

    it("answers false when the agent is not one of the workspace", async () => {
        const em = mockEntityManager({ query: [UPSERT_GRANT, []] })
        const grants = await build(em)

        await expect(grants.set({ ...recordOf(), updatedBy: "person-1" })).resolves.toBe(false)
    })
})

describe("McpToolGrantsService.upsert", () => {
    it("writes many grants in one statement, the last record of an agent and tool winning", async () => {
        const em = mockEntityManager({ query: [UPSERT_GRANTS, [{ id: "grant-1" }, { id: "grant-2" }]] })
        const grants = await build(em)

        await expect(
            grants.upsert([
                recordOf({ mode: "ask" }),
                recordOf({ tool: "sepay.*", constraints: [] }),
                recordOf({ mode: "never" }),
            ]),
        ).resolves.toBe(2)
        expect(em.query).toHaveBeenCalledWith(UPSERT_GRANTS, [
            JSON.stringify([
                {
                    workspace_id: "ws-1",
                    agent_id: "agent-1",
                    tool: "hakuen.booking.confirm",
                    mode: "never",
                    limit_vnd: null,
                    constraints: [{ arg: "discountPct", max: 5 }],
                },
                {
                    workspace_id: "ws-1",
                    agent_id: "agent-1",
                    tool: "sepay.*",
                    mode: "auto",
                    limit_vnd: null,
                    constraints: [],
                },
            ]),
        ])
    })

    it("writes nothing for no records", async () => {
        const em = mockEntityManager()
        const grants = await build(em)

        await expect(grants.upsert([])).resolves.toBe(0)
        expect(em.query).not.toHaveBeenCalled()
    })
})
