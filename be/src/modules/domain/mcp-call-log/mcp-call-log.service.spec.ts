import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { CallLogLine, CallLogRecord } from "./mcp-call-log.contracts"
import { McpCallLogService } from "./mcp-call-log.service"
import { McpCallLogEntity } from "./persistence/entities"

const ROW: CallLogRecord = {
    id: "log-1",
    tool: "hakuen.booking.hold",
    agent_name: "AI Sales",
    outcome: "ok",
    error_code: null,
    args_masked: "{}",
    result_summary: "{}",
    duration_ms: 12,
    approved_by: null,
    created_at: "2026-10-20T02:00:00.000Z",
}

const build = async (entityManager: MockEntityManager) => {
    const agents = mock<AgentDirectoryService>({
        cardsOf: jest
            .fn()
            .mockResolvedValue([{ id: "agent-1", name: "AI Sales", module: "sales", canTagAgentIds: [] }]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            McpCallLogService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return Object.assign(moduleRef.get(McpCallLogService), { doubles: { agents } })
}

/** What an insert query builder was told to write; a function value is read as its source text. */
const writtenBy = (fake: FakeQueryBuilder): Record<string, unknown> => {
    const [values] = fake.callsOf("values")[0] ?? []
    const written = typeof values === "object" && values !== null ? values : {}
    return Object.fromEntries(
        Object.entries(written).map(([key, value]) => [key, typeof value === "function" ? String(value) : value]),
    )
}

const LINE: CallLogLine = {
    workspaceId: "ws-1",
    connector: "hakuen",
    tool: "hakuen.booking.hold",
    agentId: "agent-1",
    conversationId: "conv-1",
    workItemId: null,
    argsMaskedJson: '{"code":"***"}',
    argsHash: "hash",
    outcome: "ok",
    errorCode: null,
    resultSummary: "{}",
    durationMs: 12,
    approvedBy: "person-1",
}

describe("McpCallLogService", () => {
    it("appends one audit line with every column, the masked arguments cast to jsonb by the database", async () => {
        const fake = fakeQueryBuilder({ execute: { raw: [] } })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fake.builder)
        const log = await build(em)

        await expect(log.append(LINE)).resolves.toBeUndefined()

        const { argsMasked, ...columns } = writtenBy(fake)
        expect(String(argsMasked)).toContain("CAST(:argsMaskedJson AS jsonb)")
        expect(columns).toEqual({
            workspaceId: "ws-1",
            connector: "hakuen",
            tool: "hakuen.booking.hold",
            agentId: "agent-1",
            conversationId: "conv-1",
            workItemId: null,
            argsHash: "hash",
            outcome: "ok",
            errorCode: null,
            resultSummary: "{}",
            durationMs: 12,
            approvedBy: "person-1",
        })
        expect(fake.callsOf("insert")).toEqual([[]])
        expect(fake.callsOf("setParameter")).toEqual([["argsMaskedJson", '{"code":"***"}']])
    })

    it("hands the masked arguments over as text and leaves reading them to the database", async () => {
        const fake = fakeQueryBuilder({ execute: { raw: [] } })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fake.builder)
        const log = await build(em)

        await expect(log.append({ ...LINE, argsMaskedJson: "{not json" })).resolves.toBeUndefined()

        expect(fake.callsOf("setParameter")).toEqual([["argsMaskedJson", "{not json"]])
    })

    it("reads the newest lines of the workspace within the page, each named after its agent", async () => {
        const { agent_name: _name, ...stored } = ROW
        const fake = fakeQueryBuilder({
            getRawMany: [
                { ...stored, agent_id: "agent-1" },
                { ...stored, id: "log-2", agent_id: "gone" },
                { ...stored, id: "log-3", agent_id: null },
            ],
        })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fake.builder)
        const log = await build(em)

        await expect(log.latest({ workspaceId: "ws-1", limit: 50 })).resolves.toEqual([
            ROW,
            { ...ROW, id: "log-2", agent_name: "" },
            { ...ROW, id: "log-3", agent_name: "" },
        ])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(McpCallLogEntity, "l")
        expect(log.doubles.agents.cardsOf).toHaveBeenCalledWith("ws-1", ["agent-1", "gone"])
        expect(fake.callsOf("where")).toEqual([["l.workspace_id = :workspaceId", { workspaceId: "ws-1" }]])
        expect(fake.callsOf("orderBy")).toEqual([["l.created_at", "DESC"]])
        expect(fake.callsOf("limit")).toEqual([[50]])
    })
})
