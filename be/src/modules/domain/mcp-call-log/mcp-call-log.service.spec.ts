import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
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

const build = async (entityManager: MockEntityManager): Promise<McpCallLogService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [McpCallLogService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(McpCallLogService)
}

/** What an insert query builder was told to write; a function value is read by calling it. */
const writtenBy = (fake: FakeQueryBuilder | undefined): Record<string, unknown> => {
    const [values] = fake?.callsOf("values")[0] ?? []
    return evaluatedValues(values)
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
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const log = await build(em)

        await expect(log.append(LINE)).resolves.toBeUndefined()

        const { argsMasked, ...columns } = writtenBy(fake)
        expect(argsMasked).toBe("CAST(:argsMaskedJson AS jsonb)")
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
        expect(fake?.callsOf("insert")).toEqual([[]])
        expect(fake?.callsOf("setParameter")).toEqual([["argsMaskedJson", '{"code":"***"}']])
    })

    it("hands the masked arguments over as text and leaves reading them to the database", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const log = await build(em)

        await expect(log.append({ ...LINE, argsMaskedJson: "{not json" })).resolves.toBeUndefined()

        expect(fake?.callsOf("setParameter")).toEqual([["argsMaskedJson", "{not json"]])
    })

    it("reads the newest lines of the workspace within the page", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [ROW] }])
        const log = await build(em)

        await expect(log.latest({ workspaceId: "ws-1", limit: 50 })).resolves.toEqual([ROW])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(McpCallLogEntity, "l")
        expect(fake?.callsOf("leftJoin")).toEqual([["agents", "a", "a.id = l.agent_id"]])
        expect(fake?.callsOf("where")).toEqual([["l.workspace_id = :workspaceId", { workspaceId: "ws-1" }]])
        expect(fake?.callsOf("orderBy")).toEqual([["l.created_at", "DESC"]])
        expect(fake?.callsOf("limit")).toEqual([[50]])
    })
})
